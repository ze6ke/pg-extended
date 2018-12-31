# pg-extended
[node-postgres](https://www.npmjs.com/package/pg) is a solid library that provides access to postgres through Node without pushing many opinions ono you.  This library adds a few extensions to pg that are opinionated, but provide all of the key database functionality that I typically need in my projects.

pg-extended should be 100% compatible with pg and only adds a few functions to it.

```js
let Pool = require('pg').Pool

//any connection information that doesn't come from environmental variables can be added 
//here in the Pool() call.
pool = require('pg-extended')(new Pool())

```

## runInTransaction
pg-extended allows you to control transactions through javascript on the pool and on clients.  runInTransaction takes a single function as an argument and passes it a database connection.  A transaction is opened on that db connection before the function is called.  If the function finishes normally, the transaction is committed and the functions return value is passed back through runInTransaction.  If the function throws an exception, the transaction is rolled back and the exception is rethrown by runInTransaction.

```js
let client = await pool.getClient()
try {
  let returnedValue = client.runInTransaction(async(client)=> {
    await client.query('INSERT INTO mytable VALUES (1);')
    return 'success string'
  })

  if (returnedValue = 'success string') {
    console.log('no exception was thrown, so the transaction was committed')
  }
} catch(e) {
  console.log('an exception was thrown, so the transaction was rolled backed')
}

client.release()
```


## buildTempTable
pg has nice features for inserting a single row into a table, but it requires round trips to the DB server to insert multiple rows.  In addition, programs often need to do set based validations before performing inserts, and these can be easier and more effecient when done on the database server.

buildTempTable offers an efficient way to load arbitrary numbers of records to the server for validation and processing.  It takes 4 arguments, a table name, an array of objects, a default data schema (necessary when the data array has 0 records), and a boolean specifying if the table should be dropped on commit (defaults to false and only valuable when used inside a transaction).

All fields in the temp table have type TEXT.  But, the savings in round trip time and transaction length, will outweight the costs of TEXT fields in the table in most use cases.

```js
      const data = [
        {
          a: 'hi',
          b: '2'
        },
        {
          a: 3,
          b: 4
        }
      ]

      const schema = {a:1, b:1}

      await client.buildTempTable('tableName', data, false)

      await client.query(`INSERT INTO permanent_table
                          SELECT * from tt;`)

      client.release() //this destroys the temp table
```
