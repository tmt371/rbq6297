const fs = require('fs');
const filepath = 'c:\\rbq6297\\codebase_snapshot.txt';
const content = fs.readFileSync(filepath, 'utf-8');

const files = [];
const fileRegex = /<file path="([^"]+)">([\s\S]*?)(?=<file path="|$)/g;

let match;
while ((match = fileRegex.exec(content)) !== null) {
    files.push({ path: match[1], content: match[2] });
}

console.log(`Analyzing ${files.length} files...`);

const report = {
    critical: [],
    high: [],
    moderate: []
};

function addIssue(level, file, problem, impact) {
    report[level].push(`- **File**: \`${file}\`\n  - **The Core Problem**: ${problem}\n  - **Potential Impact**: ${impact}`);
}

files.forEach(f => {
    const isUI = f.path.includes('/ui/') && f.path.endsWith('.js');
    const isService = f.path.includes('/services/');
    const isReducer = f.path.includes('/reducers/');

    // 1. Broken References / Undefined variables (basic heuristic)
    if (f.content.includes('excelExportService') && !f.path.includes('quote-persistence-service.js') && !f.content.includes('//')) {
        // e.g., removed services
    }

    // 2. Memory Leaks: Event listeners not removed
    const addListenerCount = (f.content.match(/\.addEventListener\(/g) || []).length;
    const removeListenerCount = (f.content.match(/\.removeEventListener\(/g) || []).length;
    // Special check for EventAggregator subscriptions
    const subscribeCount = (f.content.match(/\.subscribe\(/g) || []).length;
    const unsubscribeCount = (f.content.match(/\.unsubscribe\(/g) || []).length;

    // Components that subscribe should ideally unsubscribe in a destroy/teardown method
    if (isUI && f.content.includes('.subscribe(') && !f.content.includes('.unsubscribe(')) {
        addIssue('critical', f.path, 'Subscribes to EventAggregator without unsubscribing.', 'Severe memory leak. The UI component will remain in memory forever after being destroyed, and its callbacks will continue to fire, leading to duplicate execution and potential crashes.');
    }
    if (isUI && addListenerCount > removeListenerCount && !f.content.includes('removeEventListener')) {
        addIssue('high', f.path, 'Uses `addEventListener` but never calls `removeEventListener`.', 'Memory leak and potential duplication of event handling if component is re-instantiated.');
    }

    // 3. Unhandled Promises - async without try/catch
    if (f.content.includes('await ') && !f.content.includes('try {') && !f.path.includes('.spec.js')) {
        addIssue('high', f.path, 'Uses `await` without `try/catch` block.', 'Unhandled promise rejections can crash the execution context or leave the UI in a hung state with a loading spinner forever.');
    }

    // 4. State mutations outside reducer
    if (isUI && (f.content.match(/state\.[a-zA-Z0-9]+\s*=/g) || f.content.match(/quoteData\.[a-zA-Z0-9]+\s*=/g))) {
        addIssue('critical', f.path, 'Directly mutates application state instead of dispatching an action.', 'State Desync. The Redux pattern is broken, and other components/subscribers will not be notified of this change.');
    }

    // 5. DOM operations in Services/Reducers
    if ((isService || isReducer) && (f.content.includes('document.getElement') || f.content.includes('document.querySelector'))) {
        if (!f.path.includes('workflow-service') && !f.path.includes('ui-manager')) {
            addIssue('high', f.path, 'Service/Reducer manipulates the DOM directly.', 'Architectural Coupling. Business logic is tightly coupled to the UI layer, preventing testing and risking race conditions.');
        }
    }

    // 6. setTimeout without clearTimeout
    if (f.content.includes('setTimeout(') && !f.content.includes('clearTimeout(')) {
        addIssue('moderate', f.path, 'Uses `setTimeout` without saving the timer ID to `clearTimeout`.', 'Race conditions or memory leaks if the component unmounts before the timeout fires.');
    }

    // 7. WorkflowService specifics (Race Conditions)
    if (f.path.includes('workflow-service.js') && f.content.includes('document.getElementById(DOM_IDS.DIALOG_INPUT_CANCEL_REASON)')) {
        addIssue('high', f.path, 'WorkflowService is directly querying `document.getElementById` for Dialog inputs.', 'Tight coupling to DOM structure. This violates the Service boundary. If the dialog HTML changes, the cancellation flow completely breaks.');
    }

    // 8. Possible infinite loops (reactivity)
    // E.g. dispatching inside a render loop or input handler that triggers render.
});

// Extra checks:
console.log("CRITICAL:", report.critical.length);
console.log("HIGH:", report.high.length);
console.log("MODERATE:", report.moderate.length);
fs.writeFileSync('c:\\rbq6297\\audit-results.json', JSON.stringify(report, null, 2));
console.log("Wrote results to c:\\rbq6297\\audit-results.json");
