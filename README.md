## Setup
Run npm i
Install ghostscript via brew or apt
Instructions: [https://www.npmjs.com/package/compress-pdf]
Then run node src/index.js
The compressed output file will be generated


## Technologies used
Node.JS and NPM Libraries, pdf-lib, compress-pdf, GhostScript

## Approach
Faced issues with populating Template PDF as layout modification not possible with pdf-lib library. Hence
tried recreating the sections page from scratch. This parses the Json and dynamically populate the PDF based on the data.


