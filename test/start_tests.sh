#!/bin/bash

TESTFILES="test/*.js"

retval=0

node app &
pid=$!

sleep 5

echo "Starting Tests"

for f in $TESTFILES; do
	node $f
	retval=$[$retval + $?]
done

echo "Tests complete"

kill $pid
echo "Killed $pid"

exit $retval