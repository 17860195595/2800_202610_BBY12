## Quickly start

```bash
cd project_template
npm install
npm run dev
```

## About Us

Team Name: BBY-12
Team Members:

- Jiahao Zhu
- Eric Guo
- Edward Liang
- Adam Sehboub
- Markus Serban

## More details to come

TBA

## Attributions

- weather API data collection adapted from open-meteo API call generator:  
  https://open-meteo.com/en/docs
  /services/weatherService.js

- A minimal executable frontend demo for the map experience was generated with Claude AI.
  The demo includes a working Leaflet map with a `leaflet.heat` overlay, so temperature-like
  intensity data can be rendered as a visual heat layer directly on the map.
  The goal of this prototype is to provide a runnable baseline for interaction, styling, and
  future integration with real backend/location data while core user features are still in progress. Source: https://github.com/Leaflet/Leaflet.heat

- Alerts page layout structure and footer overlap fix were assisted by ChatGPT and modified/integrated by Eric Guo.  
  Source: https://chat.openai.com/

- Alerts page icon integration using Lucide Icons was assisted by ChatGPT and modified/integrated by Eric Guo.  
  ChatGPT: https://chat.openai.com/  
  Lucide Icons: https://lucide.dev/

  - Me/Profile/Settings/About page layout and navigation flow were assisted by ChatGPT and modified/integrated by Edward Liang.  
  ChatGPT: https://chat.openai.com/

  - Settings page appearance preferences was assisted by ChatGPT and modified/integrated by Edward Liang.  
  ChatGPT: https://chat.openai.com/

  - ai-chat.js and mapSummary.js logic, ai-chat.html layout, and ai-chat.css style. fully AI generated for sprint 3 popup challenge
  Copilot in vscode

  - AI chat logic in server.js moved the main risk data gathering logic into seperate function to allow the AI page to get the data, and implemented the
  AI calls to https://app.clod.io/.
  Copilot in vscode