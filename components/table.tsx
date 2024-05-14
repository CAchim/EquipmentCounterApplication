import { useState, useEffect, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import Image from 'next/image'
import { Project } from '../pages/api/counterTypes'
import confirmNOK from '../public/undraw_cancel_u-1-it.svg'
import confirmOK from '../public/confirm_OK.svg'

const ProjectsTable = (props: any) => {
  const pagesCount = useRef<number[]>(new Array())
  const firstPaint = useRef(true)
  const postPerPage = useRef(15)
  const isMounted = useRef(false)
  const inputFilterValue = useRef(null)

  const [counterInfoDB, setCounterInfoDB] = useState<Project[]>([])
  const [displayedProjects, setDisplayedProjects] = useState<Project[]>([])
  const [currentPage, setCurrentPage] = useState(0)
  const [API_Responded, setAPI_Responded] = useState<boolean>(false)
  const [connectionTimedOut, setConnectionTimedOut] = useState<boolean>(false)

  const buttonHeight = 20
  const buttonWidth = 20

  const { data: session } = useSession()

  const [EditModeForAllEntries, setEditMode] = useState<any>()

  //state for highlighting each project(notReached(0) - normal, warning(1) - yellow, limit(2) - red)
  const [highlightProject, setHighlightProject] = useState<any>([])

  const nextPage = () => {
    if (!(currentPage > pagesCount.current.length - 1))
      setCurrentPage(currentPage + 1)
  }

  const previousPage = () => {
    if (!(currentPage <= 1)) setCurrentPage(currentPage - 1)
  }

  const paginate = (page: number) => {
    setCurrentPage(page)
  }

  useEffect(() => {
    const indexOfLastProject = currentPage * postPerPage.current
    const indexOfFirstProject = indexOfLastProject - postPerPage.current
    setDisplayedProjects(
      counterInfoDB.slice(indexOfFirstProject, indexOfLastProject),
    )
    window.scrollTo(0, 0)
  }, [currentPage, counterInfoDB])

  const handleEditButton = (e: any) => {
    setEditMode(
      EditModeForAllEntries.map((item: any) => {
        if (item.entry_id === parseInt(e.target.id) - 1) {
          item = { entry_id: item.entry_id, editMode: true }
        }
        return item
      }),
    )
  }
  const handleSaveButton = async (e: any) => {
    setEditMode(
      EditModeForAllEntries.map((item: any) => {
        if (item.entry_id === parseInt(e.target.id) - 1) {
          item = { entry_id: item.entry_id, editMode: false }
        }
        return item
      }),
    )

    let ownerEmailFromEdit = document.getElementById(
      `${e.target.id - 1}_owner_email`,
    )
    let contactsLimitFromEdit = document.getElementById(
      `${e.target.id - 1}_contacts_limit`,
    )
    let warningAtFromEdit = document.getElementById(
      `${e.target.id - 1}_warning_at`,
    )

    let updateOwner = false
    let updateContactsLimit = false
    let updateWarning = false

    // @ts-ignore: Object is possibly 'null'.
    if (ownerEmailFromEdit.value != '') updateOwner = true

    // @ts-ignore: Object is possibly 'null'.
    if (contactsLimitFromEdit.value != '') updateContactsLimit = true

    // @ts-ignore: Object is possibly 'null'.
    if (warningAtFromEdit.value != '') updateWarning = true

    //XOR between contact limit and warning ->
    if (updateContactsLimit ? !updateWarning : updateWarning) {
      props.openModalAction({
        title: 'Error!',
        description: `In case you want to update Limit and Warning, you must fill in both of the fields!`,
        pictureUrl: confirmNOK,
        className: 'text-center',
      })
      return
    }
    const indexOfEntryToBeSaved = e.target.id - 1
    const projectToBeSaved: Project = counterInfoDB[indexOfEntryToBeSaved]
    const loggedUser: string = String(
      session?.user?.email || session?.user?.name,
    )
    let updateOwnerOK = false
    let updateContactsLimitAndWarningOK = false

    if (updateOwner || updateContactsLimit || updateWarning) {
      if (
        confirm(
          `Are you sure you want to save the modifications for ${projectToBeSaved.project_name} ?`,
        )
      ) {
        if (updateOwner) {
          await makeDatabaseAction(
            'updateOwner',
            0,
            '',
            projectToBeSaved.adapter_code,
            projectToBeSaved.fixture_type,
            // @ts-ignore: Object is possibly 'null'.
            ownerEmailFromEdit.value,
            0,
            0,
            loggedUser,
          )
            .then((res) => JSON.parse(String(res)))
            .then((resJSON) => {
              if (parseInt(resJSON.message.affectedRows) === 1)
                updateOwnerOK = true
              else updateOwnerOK = false
            })
        }

        if (updateContactsLimit && updateWarning) {
          await makeDatabaseAction(
            'updateContactsLimitAndWarning',
            0,
            '',
            projectToBeSaved.adapter_code,
            projectToBeSaved.fixture_type,
            '',
            // @ts-ignore: Object is possibly 'null'.
            contactsLimitFromEdit.value,
            // @ts-ignore: Object is possibly 'null'.
            warningAtFromEdit.value,
            loggedUser,
          )
            .then((res) => JSON.parse(String(res)))
            .then((resJSON) => {
              if (resJSON.message.affectedRows === 1)
                updateContactsLimitAndWarningOK = true
              else updateContactsLimitAndWarningOK = false
            })

          //in case user entered both warning and limit but the database did not update the info-> send error
          if (!updateContactsLimitAndWarningOK) {
            props.openModalAction({
              title: 'Error!',
              description: `The Limit must be greater than the Warning!`,
              pictureUrl: confirmNOK,
              className: 'text-center',
            })
            return
          }
        }
      }

      if (updateOwnerOK || updateContactsLimitAndWarningOK) {
        props.openModalAction({
          title: 'Success!',
          description: `Fixture with code ${
            projectToBeSaved.adapter_code
          } from ${projectToBeSaved.fixture_type} has been modified for
        ${updateOwnerOK ? 'Owner email' : ''}
        ${updateContactsLimitAndWarningOK ? ' Contacts limit and Warning ' : ''}
        !`,
          pictureUrl: confirmOK,
          className: 'text-center',
        })
      }
      fetchDataDB()
    }
  }

  const handleResetButton = (e: any) => {
    const indexOfEntryToBeReseted = e.target.id - 1
    const projectToBeReseted: Project = counterInfoDB[indexOfEntryToBeReseted]
    const loggedUser: string = String(
      session?.user?.email || session?.user?.name,
    )
    if (
      confirm(
        `Are you sure you want to reset contacts for ${projectToBeReseted.project_name} ?`,
      )
    ) {
      makeDatabaseAction(
        'resetCounter',
        0,
        '',
        projectToBeReseted.adapter_code,
        projectToBeReseted.fixture_type,
        '',
        0,
        0,
        loggedUser,
      )
        .then((res) => JSON.parse(String(res)))
        .then((resJSON) => {
          if (resJSON.message.affectedRows === 1) {
            props.openModalAction({
              title: 'Success!',
              description: `Fixture with code ${projectToBeReseted.adapter_code} from ${projectToBeReseted.fixture_type} has been reset to 0 contacts!`,
              pictureUrl: confirmOK,
              className: 'text-center',
            })
          } else {
            props.openModalAction({
              title: 'Error!',
              description: `An error occured when trying to reset the counter, check if the project has not been deleted in the meantime!`,
              pictureUrl: confirmNOK,
              className: 'text-center',
            })
          }
          fetchDataDB()
        })
    }
  }

  const handleDeleteButton = (e: any) => {
    const indexOfEntryToBeDeleted = e.target.id - 1
    const projectToBeDeleted: Project = counterInfoDB[indexOfEntryToBeDeleted]

    if (
      confirm(
        `Are you sure you want to delete ${projectToBeDeleted.project_name} ?`,
      )
    ) {
      makeDatabaseAction(
        'deleteProject',
        0,
        '',
        projectToBeDeleted.adapter_code,
        projectToBeDeleted.fixture_type,
        '',
        0,
        0,
        '',
      )
        .then((res) => JSON.parse(String(res)))
        .then((resJSON) => {
          if (resJSON.message.affectedRows === 1) {
            props.openModalAction({
              title: 'Success!',
              description: `Fixture with code ${projectToBeDeleted.adapter_code} from ${projectToBeDeleted.fixture_type} has been deleted!`,
              pictureUrl: confirmOK,
              className: 'text-center',
            })
          } else {
            props.openModalAction({
              title: 'Error!',
              description: `An error occured when trying to delete the project, check if it has not been deleted in the meantime!`,
              pictureUrl: confirmNOK,
              className: 'text-center',
            })
          }
          fetchDataDB()
        })
    }
  }

  const getHighlightType = (counterInfoArray: any) => {
    let highlightTypeTemp: string = ''

    return counterInfoArray.map((item: any) => {
      if (item.contacts > item.contacts_limit) {
        highlightTypeTemp = 'bg-danger'
      } else if (item.contacts > item.warning_at) {
        highlightTypeTemp = 'bg-warning'
      } else {
        highlightTypeTemp = ''
      }

      return {
        entry_id: counterInfoArray.indexOf(item),
        highlightTypeClass: highlightTypeTemp,
      }
    })
  }

  const fetchDataDB = async () => {
    console.log('Fetching new data..')
    setAPI_Responded(false)

    await fetch('/api/getCounterInfo', {
      method: 'POST',
      mode: 'cors',
      cache: 'no-cache',
      credentials: 'omit',
      body: JSON.stringify({
        action: 'getProjects',
        project_name: '',
        adapter_code: 0,
        fixture_type: '',
        owner_email: '',
        contacts_limit: 0,
        warning_at: 0,
        modified_by: '',
      }),
    })
      .then((result) =>
        result.json().then((resultJson) => {
          if (
            resultJson.message.code === 'ER_ACCESS_DENIED_ERROR' ||
            resultJson.message.code === 'ECONNREFUSED'
          )
            throw 'Cannot connect to DB'

          if (isMounted.current === true) {
            //sort the array based on contacts
            setCounterInfoDB(
              resultJson.message.sort((a: any, b: any) => {
                return b.contacts - a.contacts
              }),
            )
          }
          console.log('Data fetched successfully!')
        }),
      )
      .catch((err) => {
        console.log(err)
        if (isMounted.current === true) setConnectionTimedOut(true)
      })
  }

  useEffect(() => {
    if (isMounted.current === true) {
      if (firstPaint.current) {
        const numberOfPages = Math.ceil(
          counterInfoDB.length / postPerPage.current,
        )
        for (let i = 1; i <= numberOfPages; i++) {
          pagesCount.current.push(i)
        }
        firstPaint.current = false
      }

      setEditMode(
        counterInfoDB.map((item: any) => {
          return {
            entry_id: counterInfoDB.indexOf(item),
            editMode: false,
          }
        }),
      )
      setHighlightProject(getHighlightType(counterInfoDB))
      paginate(1)
      setAPI_Responded(true)
    }
  }, [counterInfoDB])

  const checkInputValue = (e: any) => {
    e.preventDefault()

    let projectNameFilter = ''
    let ownerEmailFilter = ''
    let fixtureTypeFilter = ''
    let adapterCodeFilter = ''
    // setProjectNameFilter("");
    // setFixtureTypeFilter("");
    // setOwnerEmailFilter("");
    const searchBy: string = e.target[0].value
    const value = e.target[1].value

    switch (searchBy) {
      case 'SearchBy':
        alert("Please select one option from the dropdown menu!")
        return
      case 'ProjectName':
        projectNameFilter = value
        break        
      case 'AdapterCode' :
        adapterCodeFilter = value
        break
      case 'FixtureType':
        fixtureTypeFilter = value
        break
      case 'OwnerEmail':
        ownerEmailFilter = value
        break
    }

    if (value === '') {
      fetchDataDB()
      return
    }

    let searchedProjects: Project[] = new Array()
    counterInfoDB.map((Project: Project) => {
      if (
        (Project.project_name
          .toLowerCase()
          .includes(projectNameFilter.toLowerCase()) &&
          projectNameFilter)||
          (Project.adapter_code.toString()
            .toLowerCase()
            .includes(adapterCodeFilter.toLowerCase()) &&
            adapterCodeFilter) ||
        (Project.owner_email
          .toLowerCase()
          .includes(ownerEmailFilter.toLowerCase()) &&
          ownerEmailFilter) ||
        (Project.fixture_type
          .toLowerCase()
          .includes(fixtureTypeFilter.toLowerCase()) &&
          fixtureTypeFilter)
      ) {
        searchedProjects.push(Project)
      }
    })
    setDisplayedProjects(searchedProjects)
  }

  //   useEffect(() => {}, [displayedProjects]);

  useEffect(() => {
    isMounted.current = true

    fetchDataDB()

    return () => {
      isMounted.current = false
    }
  }, [])

  if (API_Responded) {
    return (
      <>
        <form
          onSubmit={checkInputValue}
          className="d-flex flex-column flex-md-row mx-4 my-4 justify-content-start bg-grey align-items-center p-3 rounded shadowEffect border border-2  "
        >
          <select
            className="form-select fw-bolder w-auto mx-2 my-2"
            aria-label="Filter projects"
          >
            <option className="fw-bolder" value="SearchBy">
              Search by
            </option>
            <option className="fw-bolder" value="ProjectName">
              Project name
            </option>            
            <option className="fw-bolder" value="AdapterCode">
              Adapter Code
            </option>
            <option className="fw-bolder" value="FixtureType">
              Fixture type
            </option>
            <option className="fw-bolder" value="OwnerEmail">
              Owner email
            </option>
          </select>

          <input
            ref={inputFilterValue}
            name="inputFilterValue"
            type="text"
            className="form-control fw-bolder mx-2 my-2 searchBarWidth"
            placeholder="What are you looking for?"
            aria-label="Filter"
          ></input>
          <button
            className="btn btn-primary scaleEffect fs-6 fw-bolder w-auto mx-2 my-2"
            type="submit"
          >
            Search
            <Image
              src="/search.svg"
              className="img-fluid pt-2 ms-1"
              width={buttonWidth}
              height={buttonHeight}
              alt="filterPic"
              priority
            ></Image>
          </button>
        </form>
        <div className="table-responsive mx-4">
          <table className="table table-sm table-secondary fontSmall fw-bold border-light table-bordered text-center align-middle table-hover">
            <thead>
              <tr className="fs-6">
                {!(props.mode === 'view') ? (
                  <th className="bg-primary align-middle col-1">Menu</th>
                ) : null}
                <th className="bg-primary align-middle ">#</th>
                <th className="bg-primary align-middle ">Project name</th>
                <th className="bg-primary align-middle col-1">Adapter code</th>
                <th className="bg-primary align-middle ">Fixture type</th>
                <th className="bg-primary align-middle col-2">Owner email</th>
                <th className="bg-primary align-middle ">Contacts</th>
                <th className="bg-primary align-middle ">Limit</th>
                <th className="bg-primary align-middle ">Warning</th>
                <th className="bg-primary align-middle ">Resets</th>
                <th className="bg-primary align-middle col-2">Test Probes</th>
                <th className="bg-primary align-middle ">Modified by</th>
                <th className="bg-primary align-middle ">Last update</th>
              </tr>
            </thead>
            <tbody>
              {displayedProjects.map((Project: Project) => {
                return (
                  <tr key={counterInfoDB.indexOf(Project)}>
                    {!(props.mode === 'view') ? (
                      <td>                        
                          <button
                          onClick={handleResetButton}
                          id={(counterInfoDB.indexOf(Project) + 1).toString()}
                          className="btn btn-secondary me-2 mb-1 btn-sm pt-2 menubuttons"
                          title="Reset"
                          >
                          <Image
                            id={(counterInfoDB.indexOf(Project) + 1).toString()}
                            src="/reset.svg"
                            width={buttonWidth}
                            height={buttonHeight}
                            alt="Reset"
                            priority
                          ></Image>
                        </button>                       
                        {/* @ts-ignore */}
                        {session?.user?.user_group =='admin' || session?.user?.user_group =='TDE'? 
                        (
                        <button
                        onClick={handleDeleteButton}
                        className="btn btn-danger me-2 mb-1 btn-sm pt-2 menubuttons"
                        title="Delete"
                        id={(counterInfoDB.indexOf(Project) + 1).toString()}
                        >
                          <Image
                            id={(counterInfoDB.indexOf(Project) + 1).toString()}
                            src="/delete.svg"
                            width={buttonWidth}
                            height={buttonHeight}
                            alt="Delete"
                            className=""
                            priority
                            ></Image>
                        </button>
                        ):null}
                        {/* @ts-ignore */}
                        {session?.user?.user_group =='admin' || session?.user?.user_group =='TDE'? 
                        (EditModeForAllEntries &&
                        !EditModeForAllEntries[counterInfoDB.indexOf(Project)]
                        ?.editMode ? (  
                          <button
                            id={(counterInfoDB.indexOf(Project) + 1).toString()}
                            className="btn btn-primary me-2 mb-1 btn-sm pt-2 menubuttons"
                            onClick={handleEditButton}
                            title="Edit"
                          >
                            <Image
                              id={(
                                counterInfoDB.indexOf(Project) + 1
                              ).toString()}
                              src="/edit.svg"
                              width={buttonWidth}
                              height={buttonHeight}
                              alt="Edit"
                              className=""
                              priority
                            ></Image>
                          </button>  
                        ) : (
                          <button
                            onClick={handleSaveButton}
                            id={(counterInfoDB.indexOf(Project) + 1).toString()}
                            className="btn btn-success me-2 mb-1 btn-sm pt-2 menubuttons"
                            title="Save"
                          >
                            <Image
                              id={(
                                counterInfoDB.indexOf(Project) + 1
                              ).toString()}
                              src="/save.svg"
                              width={buttonWidth}
                              height={buttonHeight}
                              alt="Save"
                              className=""
                              priority
                            ></Image>
                          </button>                          
                        )):null} 
                      </td>
                    ) : null}

                    <td
                      className={
                        highlightProject[counterInfoDB.indexOf(Project)]
                          ?.highlightTypeClass
                      }
                    >
                      {' '}
                      {counterInfoDB.indexOf(Project) + 1}
                    </td>
                    <td
                      className={
                        highlightProject[counterInfoDB.indexOf(Project)]
                          ?.highlightTypeClass
                      }
                    >
                      {Project.project_name}
                    </td>
                    <td
                      className={
                        highlightProject[counterInfoDB.indexOf(Project)]
                          ?.highlightTypeClass
                      }
                    >
                      {Project.adapter_code}
                    </td>
                    <td
                      className={
                        highlightProject[counterInfoDB.indexOf(Project)]
                          ?.highlightTypeClass
                      }
                    >
                      {Project.fixture_type}
                    </td>
                    <td
                      className={
                        highlightProject[counterInfoDB.indexOf(Project)]
                          ?.highlightTypeClass
                      }
                    >
                      {EditModeForAllEntries &&
                      !EditModeForAllEntries[counterInfoDB.indexOf(Project)]
                        ?.editMode ? (
                        Project.owner_email
                      ) : (
                        <input
                          id={`${counterInfoDB.indexOf(Project)}_owner_email`}
                          name="owner_email_edit"
                          type="email"
                          className="form-control fw-bolder w-100"
                          placeholder="Owner email"
                          aria-label="Owner"
                        ></input>
                      )}
                    </td>
                    <td
                      className={
                        highlightProject[counterInfoDB.indexOf(Project)]
                          ?.highlightTypeClass
                      }
                    >
                      {Project.contacts}
                    </td>
                    <td
                      className={
                        highlightProject[counterInfoDB.indexOf(Project)]
                          ?.highlightTypeClass
                      }
                    >
                      {EditModeForAllEntries &&
                      !EditModeForAllEntries[counterInfoDB.indexOf(Project)]
                        ?.editMode ? (
                        Project.contacts_limit
                      ) : (
                        <input
                          id={`${counterInfoDB.indexOf(
                            Project,
                          )}_contacts_limit`}
                          name="contacts_limit_edit"
                          type="number"
                          className="form-control fw-bolder m-auto"
                          placeholder="Limit"
                          aria-label="Limit"
                        ></input>
                      )}
                    </td>
                    <td
                      className={
                        highlightProject[counterInfoDB.indexOf(Project)]
                          ?.highlightTypeClass
                      }
                    >
                      {EditModeForAllEntries &&
                      !EditModeForAllEntries[counterInfoDB.indexOf(Project)]
                        ?.editMode ? (
                        Project.warning_at
                      ) : (
                        <input
                          id={`${counterInfoDB.indexOf(Project)}_warning_at`}
                          name="warning_at_edit"
                          type="number"
                          className="form-control fw-bolder m-auto"
                          placeholder="Warning"
                          aria-label="Warning"
                          required
                        ></input>
                      )}
                    </td>
                    <td
                      className={
                        highlightProject[counterInfoDB.indexOf(Project)]
                          ?.highlightTypeClass
                      }
                    >
                      {Project.resets}
                    </td>
                    <td
                      className={
                        highlightProject[counterInfoDB.indexOf(Project)]
                          ?.highlightTypeClass
                      }
                    >
                      {Project.testprobes}
                    </td>
                    <td
                      className={
                        highlightProject[counterInfoDB.indexOf(Project)]
                          ?.highlightTypeClass
                      }
                    >
                      {Project.modified_by}
                    </td>
                    {
                      <td
                        className={
                          highlightProject[counterInfoDB.indexOf(Project)]
                            ?.highlightTypeClass
                        }
                      >
                        {new Date(Project.last_update).getFullYear()}-
                        {new Date(Project.last_update).getMonth() + 1}-
                        {new Date(Project.last_update).getDate()} &nbsp;
                        {new Date(Project.last_update).getHours()}:
                        {String(
                          new Date(Project.last_update).getMinutes(),
                        ).padStart(2, '0')}
                        {/* :{new Date(Project.last_update).getSeconds()} */}
                      </td>
                    }
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <nav
          aria-label="Page navigation"
          className="w-100 d-flex justify-content-center mt-5 mt-lg-2 px-2"
        >
          <ul className="pagination d-flex justify-content-center">
            <li className="page-item">
              <button className="page-link" onClick={previousPage}>
                Previous
              </button>
            </li>
            {pagesCount.current.map((page: number) => (
              <li
                key={page}
                id={page.toString()}
                className={
                  currentPage === page ? 'page-item active' : 'page-item'
                }
              >
                <button
                  className="page-link"
                  onClick={() => {
                    paginate(page)
                  }}
                >
                  {page}
                </button>
              </li>
            ))}
            <li className="page-item">
              <button className="page-link" onClick={nextPage}>
                Next
              </button>
            </li>
          </ul>
        </nav>
      </>
    )
  } else if (connectionTimedOut) {
    return (
      <>
        <div className="d-flex flex-column align-items-center justify-content-center screen-80 ">
          <Image
            src="/undraw_questions_re_1fy7.svg"
            height={250}
            width={800}
            alt="Error Picture"
            priority
            className="animate__animated animate__bounceIn"
          ></Image>
          <p className="text-danger display-3 text-center p-5">
            Database did not respond, please contact your administrator!
          </p>
        </div>
      </>
    )
  } else
    return (
      <>
        <div className="d-flex flex-column align-items-center justify-content-center screen-80 paddingTopBottom">
          <div className="d-flex justify-content-center">
            <div
              className="spinner-grow text-primary"
              style={{ width: '10rem', height: '10rem' }}
              role="status"
            >
              <span className=""></span>
            </div>
          </div>
          <div className="d-flex justify-content-center p-5">
            <p className="text-white display-5">Loading data...</p>
          </div>
        </div>
      </>
    )
}

export const makeDatabaseAction = (
  actionParam: string,
  entry_idParam: number,
  project_nameParam: string,
  adapter_codeParam: string,
  fixture_typeParam: string,
  owner_emailParam: string,
  contacts_limitParam: number,
  warning_atParam: number,
  modified_byParam: string,
) => {
  return new Promise((resolve) => {
    fetch('/api/getCounterInfo', {
      method: 'POST',
      mode: 'cors',
      cache: 'no-cache',
      credentials: 'omit',
      body: JSON.stringify({
        action: actionParam,
        entry_id: entry_idParam,
        project_name: project_nameParam,
        adapter_code: adapter_codeParam,
        fixture_type: fixture_typeParam,
        owner_email: owner_emailParam,
        contacts_limit: contacts_limitParam,
        warning_at: warning_atParam,
        modified_by: modified_byParam,
      }),
    })
      .then((result) => result.json())
      .then((resultJson) => {
        resolve(JSON.stringify(resultJson))
      })
  })
}

export default ProjectsTable
