#!/bin/bash

node app &
pid=$!

sleep 5

echo "Starting Tests"
node test/*.js
echo "Tests complete"

kill $pid
echo "Killed $pid"