import { createRelay } from './relay.js'

// Production entry: build the relay with default CORS/grace settings and listen.
// All behaviour lives in createRelay() so it can be driven from tests too.
const { http } = createRelay()

const PORT = Number(process.env.PORT) || 8080
http.listen(PORT, () => console.log(`relay on :${PORT}`))
