#!/bin/bash

anchor build -- -- -Znext-lockfile-bump

cp -r ./target/idl ./packages/sdk/src/generated

if [ ! -f "mpl_token_metadata.so" ]; then
  solana program dump metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s mpl_token_metadata.so
fi
