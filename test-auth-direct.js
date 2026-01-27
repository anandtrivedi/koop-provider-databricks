/**
 * Direct test of authentication function
 */

require('dotenv').config()

// Set AUTH_MODE for testing
process.env.AUTH_MODE = 'enabled'

const authenticate = require('./src/auth/authenticate')

async function test() {
  console.log('Testing authentication function directly...\n')

  // Test 1: Valid API key
  console.log('Test 1: Valid API key')
  try {
    const result = await authenticate({
      body: { apiKey: 'test-demo-key-12345' }
    })
    console.log('✅ Success! Token:', result.token.substring(0, 16) + '...')
    console.log('   Expires:', new Date(result.expires).toISOString())
    console.log('   SSL:', result.ssl)
  } catch (err) {
    console.log('❌ Error:', err.message)
  }

  // Test 2: Invalid API key
  console.log('\nTest 2: Invalid API key')
  try {
    const result = await authenticate({
      body: { apiKey: 'invalid-key-xyz' }
    })
    console.log('❌ Should have failed!')
  } catch (err) {
    console.log('✅ Expected error:', err.message)
  }

  // Test 3: Missing API key
  console.log('\nTest 3: Missing API key')
  try {
    const result = await authenticate({
      body: {}
    })
    console.log('❌ Should have failed!')
  } catch (err) {
    console.log('✅ Expected error:', err.message)
  }

  console.log('\n✅ All tests completed!')
}

test().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
