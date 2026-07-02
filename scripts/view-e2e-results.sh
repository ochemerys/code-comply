#!/bin/bash

RESULTS_DIR="./test-results"

echo "=========================================="
echo "E2E Test Results Viewer"
echo "=========================================="

if [ ! -d "$RESULTS_DIR" ]; then
    echo "❌ No test results found. Run tests first:"
    echo "   docker compose -f docker-compose.e2e.yml up --build"
    exit 1
fi

# Check if results exist
if [ ! -f "$RESULTS_DIR/cucumber-report.json" ]; then
    echo "❌ No test report found"
    exit 1
fi

# Parse results
echo ""
echo "📊 Test Summary:"
echo "----------------------------------------"

if command -v jq &> /dev/null; then
    TOTAL=$(jq '[.[] | .elements[] | .steps[]] | length' $RESULTS_DIR/cucumber-report.json 2>/dev/null || echo "0")
    PASSED=$(jq '[.[] | .elements[] | .steps[] | select(.result.status == "passed")] | length' $RESULTS_DIR/cucumber-report.json 2>/dev/null || echo "0")
    FAILED=$(jq '[.[] | .elements[] | .steps[] | select(.result.status == "failed")] | length' $RESULTS_DIR/cucumber-report.json 2>/dev/null || echo "0")
    SKIPPED=$(jq '[.[] | .elements[] | .steps[] | select(.result.status == "skipped")] | length' $RESULTS_DIR/cucumber-report.json 2>/dev/null || echo "0")
    
    echo "Total Steps:   $TOTAL"
    echo "✅ Passed:     $PASSED"
    echo "❌ Failed:     $FAILED"
    echo "⏭️  Skipped:    $SKIPPED"
    echo ""
    
    if [ "$FAILED" -gt "0" ]; then
        echo "❌ Failed Scenarios:"
        echo "----------------------------------------"
        jq -r '.[] | .elements[] | select(.steps[] | .result.status == "failed") | "  - \(.name)"' $RESULTS_DIR/cucumber-report.json 2>/dev/null
        echo ""
    fi
    
    if [ "$FAILED" -eq "0" ]; then
        echo "🎉 All tests passed!"
    else
        echo "⚠️  Some tests failed - see details below"
    fi
else
    echo "⚠️  Install jq for detailed summary:"
    echo "   macOS: brew install jq"
    echo "   Ubuntu: sudo apt-get install jq"
    echo "   Alpine: apk add jq"
fi

echo ""
echo "📁 Available Reports:"
echo "----------------------------------------"

if [ -f "$RESULTS_DIR/cucumber-report.html" ]; then
    echo "✅ HTML Report: $RESULTS_DIR/cucumber-report.html"
fi

if [ -f "$RESULTS_DIR/cucumber-report.json" ]; then
    echo "✅ JSON Report: $RESULTS_DIR/cucumber-report.json"
fi

if [ -d "$RESULTS_DIR/screenshots" ] && [ "$(ls -A $RESULTS_DIR/screenshots 2>/dev/null)" ]; then
    SCREENSHOT_COUNT=$(ls -1 $RESULTS_DIR/screenshots 2>/dev/null | wc -l | tr -d ' ')
    echo "✅ Screenshots: $SCREENSHOT_COUNT files in $RESULTS_DIR/screenshots/"
fi

if [ -d "$RESULTS_DIR/traces" ] && [ "$(ls -A $RESULTS_DIR/traces 2>/dev/null)" ]; then
    echo "✅ Traces: $RESULTS_DIR/traces/"
fi

echo ""
echo "🔍 Quick Actions:"
echo "----------------------------------------"
echo "1. View HTML report:"
echo "   open $RESULTS_DIR/cucumber-report.html"
echo ""
echo "2. View JSON summary:"
echo "   cat $RESULTS_DIR/cucumber-report.json | jq"
echo ""
echo "3. View screenshots:"
echo "   ls -la $RESULTS_DIR/screenshots/"
echo ""
echo "4. View Playwright trace:"
echo "   npx playwright show-trace $RESULTS_DIR/traces/trace.zip"
echo ""
echo "5. Clean results:"
echo "   rm -rf $RESULTS_DIR/*"
echo ""
echo "=========================================="

# Offer to open HTML report
if [ -f "$RESULTS_DIR/cucumber-report.html" ]; then
    echo ""
    read -p "Open HTML report now? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        if command -v open &> /dev/null; then
            open "$RESULTS_DIR/cucumber-report.html"
        elif command -v xdg-open &> /dev/null; then
            xdg-open "$RESULTS_DIR/cucumber-report.html"
        elif command -v start &> /dev/null; then
            start "$RESULTS_DIR/cucumber-report.html"
        else
            echo "Could not detect browser opener. Please open manually:"
            echo "  $RESULTS_DIR/cucumber-report.html"
        fi
    fi
fi
