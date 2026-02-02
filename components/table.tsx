import { useState, useEffect, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import Image from 'next/image'
import type { Project } from '../pages/api/counterTypes'
import confirmNOK from '../public/undraw_cancel_u-1-it.svg'
import confirmOK from '../public/confirm_OK.svg'
import Link from 'next/link'
import React from 'react'
import { usePlant } from "../contexts/Plantcontext"

const ProjectsTable = (props: any) => {
  // Number of columns (adjust based on your data)
  const COLUMN_COUNT = 13;
  const pagesCount = useRef<number[]>(new Array())
  const postPerPage = useRef(15)
  const isMounted = useRef(false)
  // const inputFilterValue = useRef(null)
  const inputFilterValue = useRef<HTMLInputElement>(null);
  const [columnWidths, setColumnWidths] = useState<number[]>([]);
  const measureRef = useRef<HTMLTableElement>(null);
  const [isMenuNarrow, setIsMenuNarrow] = useState(false);
  const [counterInfoDB, setCounterInfoDB] = useState<Project[]>([])
  const [allProjects, setAllProjects] = useState<Project[]>([]) // 🔹 full source array
  const [displayedProjects, setDisplayedProjects] = useState<Project[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [API_Responded, setAPI_Responded] = useState<boolean>(false)
  const [connectionTimedOut, setConnectionTimedOut] = useState<boolean>(false)
  const [expandedRows, setExpandedRows] = useState<{ [key: number]: boolean }>({});
  const toggleRowExpansion = (index: number) => {
    setExpandedRows((prev) => ({ ...prev, [index]: !prev[index] }))
  }
  const menuColRef = useRef<HTMLTableCellElement>(null);
  
  const buttonHeight = 20
  const buttonWidth = 20

  const { selectedPlant } = usePlant()
  const { data: session } = useSession()
  const isAdmin = (session?.user?.user_group || '').toString().toLowerCase() === 'admin';

  const [EditModeForAllEntries, setEditMode] = useState<any>()

  //state for highlighting each project(notReached(0) - normal, warning(1) - yellow, limit(2) - red)
  const [highlightProject, setHighlightProject] = useState<any>([])

  const previousPage = () =>
    setCurrentPage((p) => Math.max(1, p - 1))

  const nextPage = () =>
    setCurrentPage((p) =>
      Math.min(pagesCount.current.length, p + 1)
    )

  const paginate = (page: number) => {
    setCurrentPage(page)
  }

  useEffect(() => {
    if (!measureRef.current) return;

    const rows = measureRef.current.querySelectorAll('tr');
    const colCount = rows[0]?.children.length || 0;
    const maxWidths: number[] = Array(colCount).fill(0);

    rows.forEach((row) => {
      row.childNodes.forEach((cell, i) => {
        const cellWidth = (cell as HTMLElement).getBoundingClientRect().width;
        if (cellWidth > maxWidths[i]) {
          maxWidths[i] = cellWidth;
        }
      });
    });

    const columnLimits = [
      { min: 150, max: 150 },   // Menu
      { min: 30,  max: 30  },   // Row number
      { min: 150, max: 250 }, // Project name
      { min: 50,  max: 75 }, // Adapter code
      { min: 100, max: 150 }, // Fixture type
      { min: 180, max: 250 }, // Owner email
      { min: 80, max: 120 }, // Contacts
      { min: 80,  max: 120 }, // Limit
      { min: 80,  max: 120 }, // Warning
      { min: 80,  max: 100 }, // Resets
      { min: 150, max: 300 }, // Test Probes
      { min: 180, max: 250 }, // Modified by
      { min: 100, max: 150 }, // Last update
    ];

    const clampedWidths = maxWidths.map((w, i) => {
      const { min, max } = columnLimits[i];
      return Math.min(Math.max(w, min), max);
    });
    setColumnWidths(clampedWidths);
  }, [counterInfoDB]);

  const [indexLeftOffset, setIndexLeftOffset] = useState<number>(150);
  useEffect(() => {
    if (menuColRef.current) {
      const offset = menuColRef.current.offsetWidth;
      setIndexLeftOffset(offset);
    }
  }, [columnWidths]);

  useEffect(() => {
    if (!menuColRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const newWidth = entry.contentRect.width;
        setIndexLeftOffset(newWidth);
        setIsMenuNarrow(newWidth < 150);
      }
    });

    observer.observe(menuColRef.current);

    return () => {
      observer.disconnect();
    };
  }, []);


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
    ) as HTMLInputElement | null
    let contactsLimitFromEdit = document.getElementById(
      `${e.target.id - 1}_contacts_limit`,
    ) as HTMLInputElement | null
    let warningAtFromEdit = document.getElementById(
      `${e.target.id - 1}_warning_at`,
    ) as HTMLInputElement | null

    let updateOwner = false
    let updateContactsLimit = false
    let updateWarning = false

    if (ownerEmailFromEdit && ownerEmailFromEdit.value !== '') updateOwner = true
    if (contactsLimitFromEdit && contactsLimitFromEdit.value !== '') updateContactsLimit = true
    if (warningAtFromEdit && warningAtFromEdit.value !== '') updateWarning = true

    // XOR between contact limit and warning -> if only one is provided, block
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
        if (updateOwner && ownerEmailFromEdit) {
          await makeDatabaseAction(
            'updateOwner',
            projectToBeSaved.entry_id, //  use entry_id
            '',
            projectToBeSaved.adapter_code,
            projectToBeSaved.fixture_type,
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

        if (updateContactsLimit && updateWarning && contactsLimitFromEdit && warningAtFromEdit) {
          await makeDatabaseAction(
            'updateContactsLimitAndWarning',
            projectToBeSaved.entry_id, //  use entry_id
            '',
            projectToBeSaved.adapter_code,
            projectToBeSaved.fixture_type,
            '',
            Number(contactsLimitFromEdit.value),
            Number(warningAtFromEdit.value),
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
        projectToBeReseted.entry_id, //  use entry_id
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
        projectToBeDeleted.entry_id, //  use entry_id
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

  const fetchDataDB = useCallback(async () => {
    setAPI_Responded(false);

    try {
      // Build payload: only admin sends explicit plant filter
      const payload: any = { action: "getProjects" };
      if (isAdmin) {
        if (selectedPlant && selectedPlant.trim() !== "") {
          payload.plant = selectedPlant.trim();
        }
        // if admin selected "Show all" (empty), we omit plant -> API shows all
      }

      const res = await fetch("/api/getCounterInfo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // include cookies for session
        body: JSON.stringify(payload),
      });

      if (res.status === 401) {
        console.error("Unauthorized: please sign in again.");
        setConnectionTimedOut(true);
        return;
      }

      const j = await res.json();

      if (!j || !Array.isArray(j.message)) {
        console.error("Unexpected response:", j);
        setConnectionTimedOut(true);
        return;
      }

      // 🔹 sort by priority then contacts
      const sorted = (j.message as Project[]).sort((a, b) => {
        const getPriority = (proj: Project) => {
          if (proj.contacts > proj.contacts_limit) return 2; // Red
          if (proj.contacts > proj.warning_at) return 1;    // Yellow
          return 0;                                         // Green
        };
        const priorityDiff = getPriority(b) - getPriority(a);
        return priorityDiff !== 0 ? priorityDiff : b.contacts - a.contacts;
      });

      setAllProjects(sorted);          // 🔹 keep full list
      setCounterInfoDB(sorted);        // existing behavior

      const total = Math.ceil(sorted.length / postPerPage.current);
      pagesCount.current = Array.from({ length: total }, (_, i) => i + 1);
      setCurrentPage(1);
      setEditMode(sorted.map((_, i) => ({ entry_id: i, editMode: false })));
      setHighlightProject(
        sorted.map((it, i) => ({
          entry_id: i,
          highlightTypeClass:
            it.contacts > it.contacts_limit
              ? "bg-danger"
              : it.contacts > it.warning_at
              ? "bg-warning"
              : "",
        }))
      );
      setAPI_Responded(true);
    } catch (err) {
      console.error("fetchDataDB error:", err);
      if (isMounted.current) setConnectionTimedOut(true);
    }
  }, [isAdmin, selectedPlant]);

  // 🔁 Initial load + refetch on admin plant change or external trigger
  useEffect(() => {
    isMounted.current = true
    fetchDataDB()
    return () => {
      isMounted.current = false
    }
  // include trigger prop (for public view auto-refresh), admin flag, and selected plant
  }, [fetchDataDB, props.triggerFetchProp])

  const checkInputValue = (e: React.FormEvent) => {
    e.preventDefault();

    const rawValue = inputFilterValue.current?.value ?? '';
    const value = rawValue.trim().toLowerCase();

    // If input is empty, reset view from full list (no re-fetch)
    if (!value) {
      setCounterInfoDB(allProjects);

      const total = Math.ceil(allProjects.length / postPerPage.current);
      pagesCount.current = Array.from({ length: total }, (_, i) => i + 1);
      setCurrentPage(1);

      setEditMode(
        allProjects.map((_, i) => ({
          entry_id: i,
          editMode: false,
        }))
      );

      setHighlightProject(
        allProjects.map((it, i) => ({
          entry_id: i,
          highlightTypeClass:
            it.contacts > it.contacts_limit
              ? "bg-danger"
              : it.contacts > it.warning_at
              ? "bg-warning"
              : "",
        }))
      );

      return;
    }

    const fieldsToSearch: (keyof Project)[] = [
      "project_name",
      "adapter_code",
      "fixture_type",
      "owner_email",
    ];

    const source = allProjects; // 🔹 always filter from full list

    const searchedProjects: Project[] = source.filter((project) =>
      fieldsToSearch.some((field) => {
        const fieldValue = project[field];
        return fieldValue?.toString().toLowerCase().includes(value);
      })
    );

    //  Use the filtered list as the new source array for display
    setCounterInfoDB(searchedProjects);

    //  Rebuild pagination for the filtered list
    const total = Math.ceil(searchedProjects.length / postPerPage.current);
    pagesCount.current = Array.from({ length: total }, (_, i) => i + 1);
    setCurrentPage(1);

    //  Rebuild edit modes for the filtered list
    setEditMode(
      searchedProjects.map((_, i) => ({
        entry_id: i,
        editMode: false,
      }))
    );

    //  Rebuild row highlight info for the filtered list
    setHighlightProject(
      searchedProjects.map((it, i) => ({
        entry_id: i,
        highlightTypeClass:
          it.contacts > it.contacts_limit
            ? "bg-danger"
            : it.contacts > it.warning_at
            ? "bg-warning"
            : "",
      }))
    );
  };


  if (API_Responded) {
    return (
      <>
        {/* 🔹 Updated toolbar: responsive on mobile, no fixed width inline */}
        <div className="projects-toolbar d-flex justify-content-between align-items-center mx-4 py-2">
          <form
            onSubmit={checkInputValue}
            className="projects-search-form d-flex align-items-center"
          >
            <input
              ref={inputFilterValue}
              name="inputFilterValue"
              type="text"
              className="form-control fw-bolder projects-search-input"
              placeholder="Search..."
              aria-label="Filter"
            />
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
              />
            </button>
          </form>
          {(session?.user?.user_group === 'admin' ||
            session?.user?.user_group === 'engineer') && (
            <div
              className="dropdown position-relative projects-toolbar-menu"
              style={{ overflow: 'visible', zIndex: 1000 }}
            >
              <button
                className="btn btn-link buttons-hover"
                type="button"
                id="actionMenu"
                data-bs-toggle="dropdown"
                aria-expanded="false"
                title="Menu"
              >
                <Image src="/menu.svg" width={45} height={45} alt="Actions" priority />
              </button>
              <ul className="dropdown-menu dropdown-menu-end custom-dropdown" aria-labelledby="actionMenu">
                <li><h6 className="dropdown-header">Choose an action</h6></li>
                <li><Link href="/createproject"><a className="dropdown-item">Add equipment</a></Link></li>
                <li><hr className="dropdown-divider" /></li>
                <li><Link href="/addtestprobes"><a className="dropdown-item">Add test probes</a></Link></li>
                <li><Link href="/edittps"><a className="dropdown-item">Edit test probes</a></Link></li>
                <li><hr className="dropdown-divider" /></li>
                <li><Link href="/logs" passHref>
                    <a className="dropdown-item d-flex align-items-center justify-content-between">                    
                      <span>View logs</span>
                      <Image 
                        src="/history-log.svg" 
                        width={35} 
                        height={20} 
                        alt="Logs" 
                        className="me-2"
                      />
                    </a>
                  </Link>
                </li>
                <li><hr className="dropdown-divider" /></li>
                <li><Link href="/analytics" passHref><a className="dropdown-item">Analytics and forecast</a></Link></li>
                {(session?.user?.user_group === 'admin') && (
                  <div>
                    <li><hr className="dropdown-divider" /></li>
                    <li><Link href="/updatecontacts" passHref><a className="dropdown-item">Update contacts</a></Link></li> 
                  </div>   
                )}        
              </ul>
            </div>

          )}
        </div>

        <div style={{ position: 'absolute', top: 0, left: 0, height: 0, overflow: 'hidden', visibility: 'hidden' }}>
          <table ref={measureRef}>
            <thead>
              <tr>
                <th>Menu</th>
                <th></th>
                <th>Project name</th>
                <th>Adapter code</th>
                <th>Fixture type</th>
                <th>Owner email</th>
                <th>Contacts</th>
                <th>Limit</th>
                <th>Warning</th>
                <th>Resets</th>
                <th>Test Probes</th>
                <th>Modified by</th>
                <th>Last update</th>
              </tr>
            </thead>
            <tbody>
              {counterInfoDB.map((proj, i) => (
                <tr key={`measure-${i}`}>
                  <td>Actions</td>
                  <td>{i + 1}</td>
                  <td>{proj.project_name}</td>
                  <td>{proj.adapter_code}</td>
                  <td>{proj.fixture_type}</td>
                  <td>{proj.owner_email}</td>
                  <td>{proj.contacts}</td>
                  <td>{proj.contacts_limit}</td>
                  <td>{proj.warning_at}</td>
                  <td>{proj.resets}</td>
                  <td>{proj.testprobes}</td>
                  <td>{proj.modified_by}</td>
                  <td>
                    {new Date(proj.last_update).toLocaleDateString()} &nbsp;
                    {new Date(proj.last_update).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="table-wrapper">
          <div className="scroll-hint d-md-none text-center text-muted mb-2 small">
            Swipe to scroll →
          </div>
          <div className="table-responsive mx-4" style={{ overflowX: 'auto' }}>
            <table className="table table-sm table-secondary fontSmall fw-bold border-light table-bordered text-center align-middle table-hover" style={{ tableLayout: 'auto', minWidth: '1200px' }}>
              <thead>
                <tr className="fs-6" >
                  {!(props.mode === 'view') && (
                    <th ref={menuColRef} className="bg-primary align-middle sticky-col col-1" style={{ left: 0, zIndex: 1020, width: columnWidths[0] || '150px', minWidth: '60px'}} >Menu</th>
                  )}
                  <th className="bg-primary align-middle sticky-col" style={{left: !(props.mode === 'view') ? `${indexLeftOffset}px` : 0, zIndex: 1015, width: columnWidths[1] || '60px'}}></th>
                  <th className="bg-primary align-middle">Project name</th>
                  <th className="bg-primary align-middle">Adapter code</th>
                  <th className="bg-primary align-middle">Fixture type</th>
                  <th className="bg-primary align-middle">Owner email</th>
                  <th className="bg-primary align-middle">Contacts</th>
                  <th className="bg-primary align-middle">Limit</th>
                  <th className="bg-primary align-middle">Warning</th>
                  <th className="bg-primary align-middle">Resets</th>
                  <th className="bg-primary align-middle">Test Probes</th>
                  <th className="bg-primary align-middle">Modified by</th>
                  <th className="bg-primary align-middle">Last update</th>
                </tr>
              </thead>
              <tbody>
                {displayedProjects.map((proj: Project, idx: number) => {
                  const rowNumber = (currentPage - 1) * postPerPage.current + idx + 1;
                  const highlightClass = highlightProject[counterInfoDB.indexOf(proj)]?.highlightTypeClass;
                  const editMode = EditModeForAllEntries?.[counterInfoDB.indexOf(proj)]?.editMode;
                  const highlightTextColor = highlightClass === 'bg-danger' ? 'text-white'
                           : highlightClass === 'bg-warning' ? 'text-dark' 
                           : '';       
                  return (
                    <React.Fragment key={`${proj.adapter_code}-${proj.fixture_type}-${rowNumber}`}>
                      <tr className={`${highlightClass} ${highlightTextColor}`}>
                        {!(props.mode === 'view') && (
                          <td className={`sticky-col ${isMenuNarrow ? 'stack-buttons' : ''}`} style={{left: 0, zIndex: 1010 }}>
                            <div className={`d-flex justify-content-center align-items-center gap-1 menu-icon-wrapper ${isMenuNarrow ? 'flex-column' : 'flex-wrap'}`}>
                              {/* Reset */}
                              <button 
                                id={`${rowNumber}`}
                                onClick={handleResetButton} 
                                className="btn btn-secondary btn-sm pt-2 menubuttons" 
                                title="Reset counter value" 
                              >
                                <Image 
                                  id={`${rowNumber}`} 
                                  src="/reset.svg"
                                  width={buttonWidth} 
                                  height={buttonHeight} 
                                  alt="Reset" 
                                  priority 
                                />
                              </button>

                              {/* Delete */}
                              {(session?.user?.user_group === 'admin' || session?.user?.user_group === 'engineer') && (
                                <button 
                                  id={`${rowNumber}`} 
                                  onClick={handleDeleteButton} 
                                  className="btn btn-danger btn-sm pt-2 menubuttons" 
                                  title="Delete equipment"                                    
                                >
                                  <Image 
                                    id={`${rowNumber}`} 
                                    src="/delete.svg" 
                                    width={buttonWidth} 
                                    height={buttonHeight} 
                                    alt="Delete" 
                                    priority 
                                  />
                                </button>
                              )}

                              {/* Edit/Save */}
                              {(session?.user?.user_group === 'admin' || session?.user?.user_group === 'engineer') &&
                                (EditModeForAllEntries && !EditModeForAllEntries[counterInfoDB.indexOf(proj)]?.editMode ? (
                                <button 
                                  id={`${rowNumber}`} 
                                  className="btn btn-mycolor btn-sm pt-2 menubuttons" 
                                  onClick={handleEditButton} 
                                  title="Edit equipment info"
                                >
                                  <Image 
                                    id={`${rowNumber}`} 
                                    src="/edit.svg" 
                                    width={buttonWidth} 
                                    height={buttonHeight} 
                                    alt="Edit" 
                                    priority 
                                  />
                                </button>
                              ) : (
                                <button 
                                  onClick={handleSaveButton} 
                                  id={`${rowNumber}`} 
                                  className="btn btn-success btn-sm pt-2 menubuttons" 
                                  title="Save changes" 
                                >
                                  <Image 
                                    id={`${rowNumber}`} 
                                    src="/save.svg" 
                                    width={buttonWidth} 
                                    height={buttonHeight} 
                                    alt="Save" 
                                    priority 
                                  />
                                </button>
                              ))}                              
                            </div>
                          </td>
                        )}

                        <td
                          className={`sticky-col ${highlightClass}`}
                          style={{                            
                            left: !(props.mode === 'view') ? `${indexLeftOffset}px` : 0,
                            zIndex: 1005,
                            width: columnWidths[1] || '60px'
                          }}
                        >
                          {rowNumber}
                        </td>

                        <td className={highlightClass}>{proj.project_name}</td>
                        <td className={highlightClass}>{proj.adapter_code}</td>
                        <td className={highlightClass}>{proj.fixture_type}</td>

                        <td className={highlightClass}>
                          {!editMode ? (
                            proj.owner_email
                          ) : (
                            <input id={`${counterInfoDB.indexOf(proj)}_owner_email`} name="owner_email_edit" type="email" className="form-control fw-bolder w-100" placeholder="Owner email" aria-label="Owner" />
                          )}
                        </td>

                        <td className={highlightClass}>{proj.contacts}</td>

                        <td className={highlightClass}>
                          {!editMode ? (
                            proj.contacts_limit
                          ) : (
                            <input id={`${counterInfoDB.indexOf(proj)}_contacts_limit`} name="contacts_limit_edit" type="number" className="form-control fw-bolder m-auto" placeholder="Limit" aria-label="Limit" />
                          )}
                        </td>

                        <td className={highlightClass}>
                          {!editMode ? (
                            proj.warning_at
                          ) : (
                            <input id={`${counterInfoDB.indexOf(proj)}_warning_at`} name="warning_at_edit" type="number" className="form-control fw-bolder m-auto" placeholder="Warning" aria-label="Warning" required />
                          )}
                        </td>

                        <td className={highlightClass}>{proj.resets}</td>

                        <td className={`${highlightClass} test-probes-cell`}>
                          {proj.testprobes?.split(';').map((line, i) => (
                            <div key={i}>{line.trim()}</div>
                          ))}
                        </td>

                        <td className={highlightClass}>{proj.modified_by}</td>

                        <td className={highlightClass}>
                          {new Date(proj.last_update).getFullYear()}-
                          {new Date(proj.last_update).getMonth() + 1}-
                          {new Date(proj.last_update).getDate()} &nbsp;
                          {new Date(proj.last_update).getHours()}:
                          {String(new Date(proj.last_update).getMinutes()).padStart(2, '0')}
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <nav
          aria-label="Page navigation"
          className="w-100 d-flex justify-content-center mt-5 mt-lg-2 px-2"
        >
          <ul className="pagination d-flex justify-content-center">
            <li className="page-item">
              <button className="page-link fixed-width" onClick={previousPage}>
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
              <button className="page-link fixed-width" onClick={nextPage}>
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
  return new Promise((resolve, reject) => {
    fetch("/api/getCounterInfo", {
      method: "POST",
      mode: "cors",
      cache: "no-cache",
      credentials: "include", //  ensure session cookies are sent
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: actionParam,
        entry_id: entry_idParam,           //  key change (API now resolves by id)
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
        //  extra safeguard: handle unauthorized / errors gracefully
        if (resultJson?.message?.code === "ECONNREFUSED" ||
            resultJson?.message?.code === "ER_ACCESS_DENIED_ERROR") {
          reject(new Error("Database connection error"));
          return;
        }

        if (resultJson?.message === "Unauthorized") {
          reject(new Error("Unauthorized request"));
          return;
        }

        resolve(JSON.stringify(resultJson));
      })
      .catch((err) => {
        console.error("makeDatabaseAction error:", err);
        reject(err);
      });
  });
};

export default ProjectsTable
