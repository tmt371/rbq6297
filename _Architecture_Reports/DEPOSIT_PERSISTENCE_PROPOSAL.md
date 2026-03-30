# Persistence Audit: Deposit Lock (Save/Load) Proposal

This report expands upon the [Deep Deposit Lock Proposal](file:///c:/rbq6297/_Architecture_Reports/DEEP_DEPOSIT_LOCK_PROPOSAL.md) by addressing the architectural requirements for database persistence. It ensures that manual deposit locks survive browser reloads and cloud synchronization.

## 1. DATA MODEL EXPANSION
To ensure the `isDepositManuallyEdited` flag persists in the database (Firestore), it must be stored within the existing `quoteData` structure.

- **Storage Target**: `quoteData.f2Snapshot`
- **Field Name**: `isDepositManuallyEdited` (Boolean)
- **Database Path**: `quotes/{quoteId}/f2Snapshot/isDepositManuallyEdited`

### Rationale:
The system already uses `f2Snapshot` as a structural capture of the financial state at the time of saving. Storing the lock flag here ensures it is bundled with the numerical values it protects.

## 2. THE SAVE CYCLE (Persistence Audit)
- **Primary Method**: `QuotePersistenceService._getQuoteDataWithSnapshots()`
- **Logic Trace**: [quote-persistence-service.js:86](file:///c:/rbq6297/04-core-code/services/quote-persistence-service.js#L86)
- **Finding**: 
  The current save logic uses a deep clone mechanism:
  `dataWithSnapshot.f2Snapshot = JSON.parse(JSON.stringify(ui.f2));`
  
  **No code changes are required in the Persistence Service.** Because the proposal adds the flag directly to the `ui.f2` state object, the existing snapshot logic will automatically "piggyback" the lock status into the cloud payload during every save operation.

## 3. THE LOAD CYCLE (Hydration Audit)
- **Primary Method**: `WorkflowService._dispatchLoadActions()`
- **Logic Trace**: [workflow-service.js:326-330](file:///c:/rbq6297/04-core-code/services/workflow-service.js#L326-L330)
- **Finding**:
  Upon loading a quote from the Cloud or a local file:
  1. `_dispatchLoadActions` identifies the presence of `f2Snapshot`.
  2. It dispatches `uiActions.restoreF2Snapshot(data.f2Snapshot)`.
  3. The `uiReducer` ([Line 275](file:///c:/rbq6297/04-core-code/reducers/ui-reducer.js#L275)) merges the snapshot into the active UI state.

  **The "Free Hydration" Benefit**: The manual lock will be automatically restored to its correct `true/false` state upon loading. This ensures that a reloaded quote "remembers" that its $200 deposit was a deliberate human choice, preventing the auto-calculator from overwriting it when the user subsequently tweaks 'Our Offer'.

## 4. ARCHITECTURAL CONCLUSION
The proposed "Deposit Lock" mechanism fits seamlessly into the existing state-snapshot architecture. 
- **Immediate Fix**: Add `isDepositManuallyEdited` to the `initialState`.
- **UI Fix**: Update `#f2-deposit` events to toggle the flag.
- **Persistence**: Automatically handled by the deep-clone and restore logic already in place.

任務完成
