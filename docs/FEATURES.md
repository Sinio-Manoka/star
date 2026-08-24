# IDE Features

## Overview

This IDE is designed as more than a traditional code editor.

Its goal is to become a complete development environment that understands the project, prepares everything required to run it, connects code with runtime behavior, and gives developers one place to work with source code, services, APIs, databases, tests, documentation, debugging information, and development workflows.

The main difference is that the IDE does not treat the repository as only a collection of files.

It understands the project as a complete software system.

---

# 1. Project Brain

The **Project Brain** is the central intelligence layer of the IDE.

It continuously builds an understanding of the entire project and the relationships between its different parts.

The Project Brain can understand:

- applications
- modules
- source files
- classes
- functions and methods
- services
- controllers
- repositories
- APIs
- databases
- database tables
- environment variables
- runtime services
- external services
- tests
- project commands
- dependencies
- features
- relationships between components

Instead of forcing the developer to manually understand a large repository through folders and files, the IDE creates a structured model of how the project works.

Example:

```text
Checkout
├── CheckoutController
├── CheckoutService
├── PaymentService
├── OrderRepository
├── POST /checkout
├── orders table
├── payments table
├── Stripe
└── CheckoutIntegrationTest
```

The Project Brain becomes the shared knowledge source used by the rest of the IDE.

It can answer questions such as:

- What belongs to this feature?
- What depends on this service?
- Which database tables does this code use?
- Which API endpoint reaches this method?
- Which tests cover this feature?
- Which environment variables are required?
- What services must be running?
- What is affected if this component changes?

The Project Brain is not just an AI chat memory.

It is a persistent representation of the project itself.

---

# 2. Automatic Development Environment

The IDE automatically detects what is required to run a project.

When a repository is opened, the IDE analyzes its configuration and determines the required development environment.

It can detect things such as:

- programming language versions
- Java versions
- Node.js versions
- build systems
- package managers
- databases
- Redis
- Docker services
- environment variables
- application ports
- migrations
- startup commands
- service dependencies

Example:

```text
Project detected

Backend
Spring Boot
Java 25
Gradle

Frontend
Next.js
Node 24
pnpm

Infrastructure
PostgreSQL 17
Redis 8
```

The developer can then prepare and start the project directly from the IDE.

The target experience is:

```text
Open Repository
      ↓
Analyze Project
      ↓
Detect Requirements
      ↓
Prepare Environment
      ↓
Start Infrastructure
      ↓
Start Applications
      ↓
Ready
```

This reduces the need to manually install, configure, and start every dependency before working on an unfamiliar project.

---

# 3. Live Database Integration

The IDE connects the project source code directly to the database.

Developers can inspect the database without leaving the IDE.

The database view can show:

- schemas
- tables
- columns
- data types
- indexes
- relationships
- rows
- queries
- migrations

The IDE also understands relationships between source code and database structures.

Example:

```text
User Entity
    ↓
users table

User.email
    ↓
users.email
```

When a developer changes a database-related model, the IDE can identify the possible schema impact.

Example:

```text
User.email
changed to
User.primaryEmail
```

The IDE can detect that the existing database still contains:

```text
users.email
```

and present the developer with the relevant schema information.

Long term, this feature can support:

- schema comparison
- migration generation
- safe data editing
- query execution
- code-to-column navigation
- column-to-code navigation
- database change previews

The database becomes a first-class part of the project instead of an external tool.

---

# 4. API World

The IDE automatically discovers and organizes the APIs exposed by the project.

Instead of requiring a separate API client, the developer can inspect and use project APIs directly inside the IDE.

Example:

```text
Auth
├── POST /login
└── POST /refresh

Users
├── GET /users
├── GET /users/{id}
├── POST /users
└── DELETE /users/{id}

Orders
├── GET /orders
└── POST /orders
```

Each endpoint can show:

- HTTP method
- route
- source location
- request parameters
- request body
- headers
- authentication requirements
- response structure
- runtime traces
- related database tables
- related source code

The developer can execute requests directly.

Example:

```text
POST /orders

Body
{
  "productId": 123,
  "quantity": 2
}

[ Send ]
```

Because the API view is connected to the Project Brain, the IDE can also display the complete execution path.

Example:

```text
POST /orders
    ↓
OrderController
    ↓
OrderService
    ↓
OrderRepository
    ↓
PostgreSQL
```

The API system is therefore more than a built-in Postman replacement.

It connects APIs directly to the project's architecture and runtime behavior.

---

# 5. Built-in Production Simulator

The IDE can simulate production-like usage before the application is deployed.

Developers can define scenarios such as:

- number of users
- concurrent requests
- request distribution
- traffic patterns
- database latency
- external API latency
- duration
- network conditions

Example:

```text
Simulation

Users
10,000

Duration
5 minutes

Traffic
Search        35%
Products      25%
Checkout      20%
Homepage      20%
```

During the simulation, the IDE can observe:

- response times
- CPU usage
- memory usage
- requests per second
- error rates
- database pressure
- slow queries
- service bottlenecks
- external service latency

Example result:

```text
System stable until:
7,430 concurrent users

Primary bottleneck:
PostgreSQL connection pool

Affected code:
OrderRepository.findAvailable()
```

The developer can navigate directly from a performance problem to the code responsible for it.

The goal is to make basic load and scalability testing part of normal development rather than something performed only after deployment.

---

# 6. Chaos Mode

Chaos Mode intentionally introduces failures into the local development environment.

The goal is to help developers discover how the application behaves when infrastructure and dependencies fail.

Possible chaos scenarios include:

- stop PostgreSQL
- stop Redis
- terminate an application process
- simulate external API failures
- return HTTP 500 responses
- add network latency
- add packet loss
- simulate timeouts
- create CPU pressure
- create memory pressure
- simulate disk problems
- duplicate messages
- delay messages
- reorder events

Example:

```text
Chaos Scenario

Redis unavailable
```

The IDE observes what happens and creates a report.

Example:

```text
Result

Application remained online       ✓
Product search fallback worked    ✓
Checkout latency increased        ⚠

Unexpected effect:
Checkout slowed by 230%

Possible cause:
Shared executor saturation
```

Chaos Mode helps developers find reliability problems before users experience them.

---

# 7. Runtime-based Test Generator

The IDE can generate tests from actual application usage.

Instead of asking AI to guess how a method should be tested, the IDE watches real execution.

Example developer flow:

```text
Login
↓
Search product
↓
Add product
↓
Checkout
```

The developer can then select:

```text
Save Session as Test
```

The IDE uses the observed behavior to create a test scenario.

Example:

```text
Given
User is authenticated
Product exists
Inventory is available

When
POST /checkout is executed

Then
Order is created
Inventory is reduced
Payment is initiated
```

The developer can choose the desired test type.

Possible outputs:

- unit test
- integration test
- API test
- end-to-end test
- regression test

The important difference is that the generated test is based on actual runtime behavior.

This can also be used after fixing bugs.

Example:

```text
Bug reproduced
↓
Fix implemented
↓
Generate regression test
```

---

# 8. Developer Sessions

A developer can share a complete development or debugging session with another developer.

Instead of sending screenshots, logs, setup instructions, and environment details separately, the IDE can package the relevant project state.

A shared session can include:

- Git commit
- current code changes
- environment information
- runtime versions
- running services
- relevant logs
- failing request
- trace information
- breakpoints
- database snapshot
- selected files
- task context

Example:

```text
Share Debug Session
```

The IDE creates a shareable session.

Another developer can open it and restore the relevant state.

Example:

```text
Restoring shared session...

Code state       ✓
Environment      ✓
Services         ✓
Logs             ✓
Failing request  ✓
```

This feature is intended to make collaborative debugging much faster and more reproducible.

---

# 9. Automatic Documentation from Reality

The IDE automatically builds documentation from the actual project structure and runtime behavior.

Traditional documentation often becomes outdated because developers must maintain it manually.

This IDE continuously generates documentation from what the project actually does.

Example:

```text
Checkout

Purpose
Creates an order and initiates payment.

Entry Point
POST /checkout

Flow

Client
  ↓
CheckoutController
  ↓
CheckoutService
  ├── InventoryService
  ├── PaymentService
  └── OrderRepository
          ↓
      PostgreSQL

External Services
Stripe

Database
orders
payments

Tests
CheckoutIntegrationTest
```

Documentation can include:

- architecture
- features
- APIs
- service relationships
- database relationships
- runtime flows
- environment requirements
- commands
- known dependencies
- external services
- tests

Because the documentation is generated from the Project Brain and runtime data, it can stay synchronized with the actual application.

---

# 10. Zero-setup Observability

The IDE provides built-in observability for local development.

Developers should not need to manually configure several external tools just to understand what their application is doing.

The IDE can provide:

- logs
- requests
- traces
- spans
- CPU usage
- memory usage
- network activity
- errors
- database queries
- process information
- thread information
- service health
- response times

Example:

```text
POST /checkout                         312 ms
│
├── Authentication                      4 ms
├── CheckoutController                  2 ms
├── CheckoutService                   291 ms
│   ├── InventoryRepository            18 ms
│   ├── Stripe                        241 ms
│   └── OrderRepository                19 ms
└── Serialization                       3 ms
```

The developer can click a span and jump directly to the relevant source code.

Example:

```text
Stripe
241 ms
```

opens the exact call responsible for that runtime activity.

Observability is directly connected to source code and the Project Brain rather than being isolated in a separate monitoring application.

---

# 11. Personal Development Analytics

The IDE can provide private analytics about the developer's own workflow.

The purpose is not employee monitoring.

The purpose is to help the developer understand where time and friction occur during development.

Example:

```text
This Week

Coding                 11h 23m
Debugging               4h 17m
Testing                 2h 42m
Reading Code            3h 08m
Environment Problems    1h 03m
```

The IDE can identify patterns such as:

- files frequently opened together
- components frequently changed together
- modules causing repeated debugging
- commands frequently failing
- recurring environment problems
- areas with high development friction

Example:

```text
Frequent Friction

PaymentService
Revisited 37 times

Docker startup
5 failed attempts

OrderService + OrderMapper
Changed together in 82% of sessions
```

The IDE can use this information to improve the user's workflow.

Example:

```text
You frequently work with:

OrderController
OrderService
OrderMapper
OrderRepository

Create an Orders workspace?
```

Analytics should remain local and private by default.

---

# 12. Project Commands

The IDE automatically discovers project commands and converts them into consistent actions.

A developer should not need to remember every build-system or package-manager command.

The IDE can discover commands such as:

```text
./gradlew bootRun
./gradlew test
npm run dev
npm run build
docker compose up
```

and present them as:

```text
Start Project
Stop Project
Restart Project

Build Project
Run Tests

Start Backend
Start Frontend

Start Database
Reset Database
Run Migrations
```

This makes different technology stacks feel consistent.

For example, a developer can use:

```text
Run Tests
```

without caring whether the project uses:

- Gradle
- Maven
- npm
- pnpm
- another supported build system

Project Commands become a unified action system used across the IDE.

---

# 13. Automatic Task Workspaces

The IDE organizes development around tasks and problems instead of only files and folders.

A developer can create a task such as:

```text
Fix duplicate checkout issue
```

The IDE then creates a focused workspace containing everything relevant to that task.

Example:

```text
Duplicate Checkout

Relevant Code
├── CheckoutController
├── CheckoutService
├── PaymentService
└── OrderRepository

Relevant API
└── POST /checkout

Relevant Database
├── orders
└── payments

Relevant Tests
└── CheckoutIntegrationTest

Runtime
├── recent checkout traces
└── duplicate order errors
```

The workspace can include:

- source files
- classes
- methods
- APIs
- database tables
- logs
- traces
- tests
- commands
- documentation
- notes
- AI conversations
- recent runtime sessions

This allows developers to work on a problem without constantly navigating through unrelated parts of a large repository.

The traditional file explorer still exists, but the task workspace becomes a higher-level way of working.

---

# How the Features Work Together

The most important part of the IDE is that these features are connected.

They are not independent tools placed inside one application.

Example problem:

```text
Checkout sometimes creates two orders.
```

The IDE can create a task workspace automatically.

```text
Duplicate Checkout
```

The Project Brain identifies:

```text
CheckoutController
CheckoutService
OrderRepository
POST /checkout
orders table
checkout tests
```

Observability shows:

```text
Two identical requests arrived within 83 ms.
```

The developer reproduces the issue.

The runtime-based test generator creates a regression test.

Chaos Mode tests duplicate requests under network latency.

The database view confirms that only one order is created after the fix.

Automatic documentation updates the checkout behavior.

The entire workflow remains connected inside the IDE.

---

# Product Experience

The IDE should ultimately make these five promises to developers.

## Open any supported project and understand it

The Project Brain explains what the repository contains and how the system fits together.

## Open a project and run it

The environment engine prepares the required development environment and services.

## Understand what the application is doing

Runtime information, APIs, databases, logs, traces, and source code are connected.

## Find problems before production

Production simulation, observability, generated tests, and Chaos Mode help expose failures earlier.

## Share development state instead of instructions

Developer Sessions make bugs and debugging environments reproducible.

---

# Main IDE Areas

The interface can group the feature set into a small number of major areas.

```text
WORK
BRAIN
RUN
OBSERVE
DATA
AI
```

## WORK

Task workspaces and active development tasks.

## BRAIN

Project understanding, architecture, relationships, features, dependencies, and documentation.

## RUN

Environment preparation, applications, infrastructure, runtime services, and project commands.

## OBSERVE

Logs, traces, performance, production simulation, Chaos Mode, and runtime activity.

## DATA

APIs and databases.

## AI

Project-aware AI with access to the Project Brain and IDE tools.

---

# Core Idea

The defining feature of the IDE is not simply AI.

It is that the IDE has a connected understanding of the complete development system.

```text
Code
Environment
Runtime
Database
APIs
Tests
Documentation
Observability
Tasks
Developer Workflow
       │
       └──────► Project Brain
```

Every major feature contributes information to this shared understanding.

This is what allows the IDE to behave as a complete development environment rather than only a source-code editor.
