import type { NextApiRequest, NextApiResponse } from 'next'
import queryDatabase from '../../lib/database'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<any>,
) {
  const reqJSON = JSON.parse(req.body)
  let sqlCommand: string = ''

  switch (reqJSON.action) {
    case 'addUser':
      console.log('Client asks to add a new user')
      sqlCommand = `call addUser("${reqJSON.first_name}", "${reqJSON.last_name}", "${reqJSON.user_id}", "${reqJSON.email}", "${reqJSON.user_password}", "${reqJSON.user_group}");`
      break

    case 'removeUser':
      console.log('Client asks to remove an user')
      sqlCommand = `call removeUser("${reqJSON.user_id}");`
      break
    case 'findUser':
      console.log('Client asks to find an user')
      sqlCommand = `call findUser("${reqJSON.email}");`
      break      

    case 'sgetEmailsByUserGroup':
      console.log('Client asks to update owner email')
      sqlCommand = `call getEmailsByUserGroup("${reqJSON.user_group}");`
      break

    default:
      console.log('Client asks for an unknown commad')
      sqlCommand = ''
      break
  }

  return new Promise((resolve, reject) => {
    queryDatabase(sqlCommand)
      .then((result) =>
        resolve(res.status(200).json({ message: result, status: 200 })),
      )
      .catch((err) => {
        console.log(err)
        resolve(res.status(500).json({ message: err, status: 500 }))
      })
  })
}
