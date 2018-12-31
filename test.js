const expect = require('chai').expect


it('test harness is working', function () {
  console.log('yeah!')
})

it('can be required', function () {
  require('./index.js')
})

describe('library functions', function () {

  let pool 
  
  it('pg can be loaded', function () {
    require('pg')
  })

  it('pg can connect to test db', function () {
    let Pool = require('pg').Pool
    pool = new Pool()
  })

  it('pg can run queries', function () {
    return pool.query('select 1')
  })

  it('pg can be extended', function () {
    pool = require('./index.js')(pool)
  })


})
