const expect = require('chai').expect

let pool 

const createTempTable = `create temp table tt (id int);`

describe('pg', function () {

  it('pg can be loaded', function () {
    require('pg')
  })

  it('pg can connect to test db', function () {
    let Pool = require('pg').Pool
    pool = new Pool()
  })

  it('pg can run queries', async function () {
    try {
      await pool.query('select 1')
    } catch (e) {
      console.error("Ensure that you have a db and that PGUSER, PGHOST, and PGPASSWORD are set correctly.")
      throw e
    }
  })
})

describe('pg-extended', function () {

  describe('core functionality', function () {

    it('pg can be extended', function () {
      pool = require('./index.js')(pool)
    })

    it('can run queries', async function () {
      let dbResult = await pool.query('select 1;')
      expect(dbResult.rowCount).to.equal(1)
    })

    it('clears temp tables correctly', async function () {
      await pool.query('create temp table hi (id int);')

      let dbResult = await pool.query(`select to_regclass('hi')`);
      expect(dbResult.rows[0].to_regclass).to.not.be.ok
    })
  })


  describe('transactions', function () {

    it('can run a transaction', async function() {
      await pool.runInTransaction(()=>undefined)
    })

    it('can rollback a transaction', async function() {
      let client = await pool.getClient()

      await client.query(createTempTable)

      let exceptionThrown = false

      try {
        await client.runInTransaction(async(client)=> {
          await client.query(`insert into tt values (1);`)
          throw new Error('roll it back')
        })
      } catch (e) {
        exceptionThrown = true
      }

      let dbResult = await client.query(`select * from tt;`)

      client.release()

      expect(exceptionThrown, 'exception thrown').to.equal(true)
      expect(dbResult.rowCount).to.equal(0)
    })

    it('can commit a transaction', async function() {
      let client = await pool.getClient()

      await client.query(createTempTable)

      let exceptionThrown = false

      try {
        await client.runInTransaction(async(client)=> {
          await client.query(`insert into tt values (1);`)
        })
      } catch (e) {
        exceptionThrown = true
      }

      let dbResult = await client.query(`select * from tt;`)

      client.release()

      expect(exceptionThrown, 'exception thrown').to.equal(false)
      expect(dbResult.rowCount).to.equal(1)
    })

    it('can rollback a transaction on pool', async function() {

      let exceptionThrown = false
      try {
        await pool.runInTransaction(async(client)=>{
          client.query('create table hi (id int);') //permanent table
          throw new Error('roll it back')
        })
      } catch (e) {
        exceptionThrown = true
      }

      let dbResult = await pool.query(`select to_regclass('hi')`);

      expect(exceptionThrown).to.equal(true)
      expect(dbResult.rows[0].to_regclass).to.not.be.ok
    })



  })

  describe('temp tables', function () {

    it('can build a temp table', async function () {
      let client = await pool.getClient()

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

      await client.buildTempTable('tableName', data)

      let dbResult = await client.query('select * from tableName;')

      client.release()

      expect(dbResult.rows.length).to.equal(2)
    })

    it('rejects invalid input', async function () {
      let client = await pool.getClient()
      let exceptionThrown = false

      const data = [
        {
          'a"': 'hi',
          b: 'there'
        }
      ]

      try {
        await client.buildTempTable('tableName', data)
      } catch (e) {
        exceptionThrown = true
      }
      client.release()

      expect(exceptionThrown).to.equal(true)
    })

    it('uses schemas', async function() {
      let client = await pool.getClient()

      const data = []
      const schema = {a:1, b:1}

      await client.buildTempTable('tt', data, schema)

      let dbResult = await client.query(`select to_regclass('tt')`);

      client.release()

      expect(dbResult.rows[0].to_regclass).to.be.ok
    })
  })

})
