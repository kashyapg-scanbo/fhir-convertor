Flow Summary
Client sends JSON → POST /convert
API validates input
JSON → Converted to FHIR Bundle[]
FHIR data sent to MCP
MCP:
    Encrypts PHI
    Stores data in:
        IPFS
        Ethereum (or other blockchain)
MCP returns:
    CID
    Transaction Hash
    Status
API stores only non-PHI metadata in MongoDB
API returns success response to client