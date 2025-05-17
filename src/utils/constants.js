export const ENV = {
  RPC_ENDPOINT: process.env.RPC_ENDPOINT,
  DATABASE_URL: process.env.DATABASE_URL,
  STARTING_BLOCK_HEIGHT: +process.env.STARTING_BLOCK_HEIGHT,
  FETCH_LIMIT: +process.env.FETCH_LIMIT,
  INSERT_LIMIT_PER_CALL: +process.env.INSERT_LIMIT_PER_CALL,
  IS_LIMIT_INSERT: process.env.IS_LIMIT_INSERT === "true",
};

export const HEADERS = {
  "Content-Type": "application/json",
};
