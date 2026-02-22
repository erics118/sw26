# Submission for NYU Startup Week 2026 Buildathon

## Inspiration
Charter operators waste time and lose potential revenue due to fragmented data, manual routing, and empty legs. They depend on humans for a lot of the work, leading to potential losses and errors. This also leads to suboptimal routing, underutilized aircraft, and costly empty-leg flights. We saw an opportunity to centralize decision-making with AI. 

## What it does
SkyOps is an AI operations dashboard that optimizes routing, forecasting, and fleet utilization to reduce empty legs and increase revenue per flight hour.

With SkyOps, operators can:
- visualize incoming trip requests and quotes in one unified dashboard
- automatically design routes and and plans with minimal human intervention
- forecast future demand and aircraft positioning requirements
- identify and reduce empty-leg flights
- receive AI-assisted routing and scheduling accommodations
- track revenue per flight and utilization metrics

## How we built it
We unified trip, quote, and fleet data into a structured model, built deterministic forecasting logic, and layered AI agents for probability and routing recommendations.

We developed a centralized data layer that normalizes trips, pricing, and fleet data. We designed relational schemas to connect all the segmented data together.

Agentic AI workflows were used to design routes efficiently. This allowed us to incorporate various data types, such as weather, NOTAM alerts, airport conditions, and more, and generate the best route where a human may fail to optimize.

Eric, Akhil, and Charlie focused on building the backend, working on structuring the database, designing the forecasting and utilization engines, and implementing the AI agents that handle the routing and repositioning recommendations.

Rohan worked on making the front-end look clean and visually appealing, and also conducted market research.

## Challenges we ran into
Forecasting uncertainty, and creating a properly functioning database. There are so many factors in designing something for such a complicated workflow. We needed to make sure we included all the relevant data for flights, without making the system messy and difficult to use. 

Creating a relational database schema that accurately represented complex aviation operations required us to iterate through various plans, as we needed to ensure consistency across different uses.

Much of the data we found was incomplete or nonexistent, so we had to validate and standardize the data, or find alternative sources to use.

## Accomplishments that we're proud of
We are proud that we were able to build an end-to-end prototype that turns messy trip requests into actionable routing and utilization insights in one dashboard in such a short amount of time. 

## What we learned
AI works best when paired with deterministic planning and clear constraints. Centralized data is the real unlock in charter operations. Operators will trust recommendations more when they are backed by sufficient reasoning.

## What's next for SkyOps
Improve forecasting accuracy, expand pricing optimization, integrate crew/maintenance constraints, and pilot our product with small-to-mid charter plane operators.
