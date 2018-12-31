


function setupPool (pool) {
  pool.getClient = async function () {
    let client = await pool.connect()

    client.buildTempTable = function (tableName, data, dropOnCommit, schema) {
      return buildTempTable(tableName, data, dropOnCommit, schema, client)
    }

    let oldFunction = client.release

    client.release = async function () {
      try {
        connectionCleanup(client)
      } catch (e) {
        console.log('received DB error on release function: ', e)
      } finally {
        oldFunction.apply(client)
      }
    }

    return client
  }

  pool.query = async function (...args) {
    let client 
    try {
      client = await this.getClient()
      return await client.query(...args)
    } finally {
      if(client) {
        client.release()
      }
    }
  }

  /**
   *  * runs a function inside of a transaction and commits unless an exception is throw.  After resolving the transaction it passes back either the return value or the exception
   *   */
  pool.runInTransaction = async function (f) {
    let dbClient = null

    try {
      dbClient = await this.getClient()

      await dbClient.query('BEGIN;')

      let retval = await f(dbClient)

      await dbClient.query('COMMIT;')

      dbClient.release()

      return retval

    } catch (e) {//always rollback on exception if the transaction was opened
      if(dbClient) {
        let caughtException
        try {
          await dbClient.query('ROLLBACK;')//rollback any work that hasn't been committed.
        } catch (e) {
          caughtException = e
        }

        dbClient.release()
        if(caughtException) { //there's no helpful way to notify the user of the inner exception
          console.error(caughtException)
        }
      }

      throw e //and rethrow the exception
    }
  }

  return pool
}


function connectionCleanup (client) {
  return client.query('DISCARD ALL')
}

/**
 * a function that takes an array of identical objects and creates a temp table on the server.
 * It hasn't been optimized for speed, but is locked down enough that it should be secure
 */
async function buildTempTable(name, data, dropOnCommit = false, schema, client) {
  //validate input
  if(data.length === undefined) {
    throw new Error('data needs to be an array of identical objects.')
  }

  let fields 

  if(typeof(schema) === 'object' && schema !== null) {
    fields = Object.keys(schema).sort()
  } else if(data.length) {
    fields = Object.keys(data[0]).sort()
  } else {
    throw new Error('Data has length 0 and no schema was provided')
  }

  let fieldProblems = fields.filter(field=>!(dbUtil.fieldValidationPattern.test(field)))

  if(fieldProblems.length) {
    throw new Error('each field in data needs to begin with a letter and then have 0 or more letters and numbers')
  }

  if(!client) {
    throw new Error('buildTempTable: client is required')
  }

  //build query string
  let fieldBuildString = fields.reduce((str, field) => str += `${field} TEXT, `, '') 
  fieldBuildString = fieldBuildString.slice(0, -2)//remove the last comma
  let buildTableQuery = `CREATE TEMP TABLE ${name} 
  (
    ${fieldBuildString}
  )`

  if(dropOnCommit) {
    buildTableQuery += 'ON COMMIT DROP;'
  } else {
    buildTableQuery += ';'
  }

  await client.query(buildTableQuery)

  //load data

  let populateQuery = `INSERT INTO ${name}
    SELECT * 
    FROM JSON_POPULATE_RECORDSET(null::${name}, $1);`

  await client.query(populateQuery, [JSON.stringify(data)])
}

module.exports = setupPool
