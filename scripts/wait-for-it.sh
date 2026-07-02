#!/usr/bin/env bash
# wait-for-it.sh - Wait for a service to be available
# Usage: ./wait-for-it.sh host:port [-t timeout] [-- command args]

set -e

TIMEOUT=60
QUIET=0
HOST=""
PORT=""

usage() {
    cat << USAGE >&2
Usage:
    $0 host:port [-t timeout] [-q] [-- command args]
    -t TIMEOUT                  Timeout in seconds, zero for no timeout
    -q                          Quiet mode
    -- COMMAND ARGS             Execute command with args after the test finishes
USAGE
    exit 1
}

wait_for() {
    if [ "$TIMEOUT" -gt 0 ]; then
        echo "Waiting $TIMEOUT seconds for $HOST:$PORT..."
    else
        echo "Waiting for $HOST:$PORT without a timeout..."
    fi
    
    START_TS=$(date +%s)
    while :
    do
        if [ "$QUIET" -ne 1 ]; then
            (echo > /dev/tcp/$HOST/$PORT) >/dev/null 2>&1
        else
            (echo > /dev/tcp/$HOST/$PORT) >/dev/null 2>&1
        fi
        
        RESULT=$?
        if [ $RESULT -eq 0 ]; then
            END_TS=$(date +%s)
            echo "$HOST:$PORT is available after $((END_TS - START_TS)) seconds"
            break
        fi
        
        if [ "$TIMEOUT" -gt 0 ]; then
            END_TS=$(date +%s)
            if [ $((END_TS - START_TS)) -ge "$TIMEOUT" ]; then
                echo "Timeout occurred after waiting $TIMEOUT seconds for $HOST:$PORT"
                exit 1
            fi
        fi
        
        sleep 1
    done
}

# Parse arguments
while [ $# -gt 0 ]
do
    case "$1" in
        *:* )
        HOST=$(echo $1 | cut -d : -f 1)
        PORT=$(echo $1 | cut -d : -f 2)
        shift 1
        ;;
        -q | --quiet)
        QUIET=1
        shift 1
        ;;
        -t)
        TIMEOUT="$2"
        if [ "$TIMEOUT" = "" ]; then break; fi
        shift 2
        ;;
        --)
        shift
        break
        ;;
        --help)
        usage
        ;;
        *)
        echo "Unknown argument: $1"
        usage
        ;;
    esac
done

if [ "$HOST" = "" ] || [ "$PORT" = "" ]; then
    echo "Error: you need to provide a host and port to test."
    usage
fi

wait_for

# Execute command if provided
if [ $# -gt 0 ]; then
    exec "$@"
fi
