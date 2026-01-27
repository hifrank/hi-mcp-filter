// Jest setup file
// Configure test environment before running tests

process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';

// Set default timeout for all tests
jest.setTimeout(10000);
