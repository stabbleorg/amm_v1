#!/bin/bash

anchor build

cp -r ./target/idl ./packages/sdk/src/generated

if [ ! -f "tests/fixtures/mpl_token_metadata.so" ]; then
  mkdir -p tests/fixtures

  solana program dump metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s tests/fixtures/mpl_token_metadata.so
fi
