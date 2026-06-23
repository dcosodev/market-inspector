Feature: Quota-conscious market intelligence demonstration
  Market Inspector should demonstrate agentic behavior without wasting Gemini calls
  or presenting informational analysis as personalized financial advice.

  Scenario: Automatic scan finds no anomaly
    Given the deterministic detector is running
    When all monitored crypto moves remain below the configured threshold
    Then the latest anomaly list is empty
    And no Gemini request is made
    And the state is streamed to connected dashboard clients

  Scenario: Manual scan finds only low-severity movement
    Given a user starts a manual AI scan
    When every detected anomaly has low severity
    Then a deterministic local brief is returned
    And no Gemini request is made
    And the brief contains neutral monitoring language

  Scenario: Manual scan finds a notable anomaly
    Given a user has remaining local demo quota
    When a medium-or-higher anomaly is detected
    Then seven market results are requested in parallel
    And Gemini receives only successful snapshot sections
    And Gemini can request only the eight selected read-only tools
    And the final brief includes analysis, monitoring priorities, outlook, and a disclaimer

  Scenario: A primary provider fails
    Given a source has a documented fallback
    When the primary provider is unavailable or rate-limited
    Then the fallback provider is attempted
    And the selected provider and fallback status are observable in structured logs when known
    And the scan continues if sufficient data remains

  Scenario: Equivalent scans arrive concurrently
    Given a market scan is already running
    When another equivalent request arrives
    Then the orchestrator reuses the active result
    And anomaly detection is not duplicated
    And Gemini generation is not duplicated

  Scenario: Browser storage is unavailable
    Given localStorage rejects a write
    When the user starts a manual scan
    Then the scan can still proceed
    And an in-session quota decrement is shown
    And no server-side persistence is required

  Scenario: Untrusted data contains instructions
    Given provider, tool, or user text contains an instruction to change role or reveal secrets
    When the text is sent to Gemini
    Then it is delimited as untrusted data
    And the system instruction says to ignore embedded instructions
    And no secret or privileged instruction is followed

  Scenario: Continuous integration runs
    Given no API secrets are configured
    When the CI workflow executes
    Then lint, type checking, deterministic tests, mocked E2E, and build run on Node.js 22
    And no Gemini or live market-provider request is required
