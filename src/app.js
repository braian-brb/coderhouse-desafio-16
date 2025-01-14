/* eslint-disable no-unused-vars */
import express, { urlencoded, json } from 'express'
import { engine } from 'express-handlebars'
import path, { dirname } from 'path'
import { fileURLToPath } from 'url'
import { Server as HttpServer } from 'http'
import { Server as IOServer } from 'socket.io'
import cookieParser from 'cookie-parser'
import flash from 'connect-flash'
import compression from 'compression'
import passport from 'passport'
// pasar todo a un index de cada carpeta e importar desde ahi, ejemplo todas las routes hacer un index.js y de ahi que se exporte todo
import './middlewares/passport.js'
import {
  errorHandler,
  globalVars,
  loggerNonExistent
} from './middlewares/index.js'
import indexRouter from './routes/index.routes.js'
import { logger, randomNumberToJSON, sessionMongo } from './utils/index.js'
import { ProductsControllerRest, MessagesControllerRest, messagesControllersGraphql, productsControllersGraphql } from './controllers/index.controllers.js'
import config from './config/index.config.js'

export const app = express()
export const httpServer = new HttpServer(app)
const io = new IOServer(httpServer)

export const __dirname = dirname(fileURLToPath(import.meta.url))

/* ------- SETTINGS ------- */
// app.set('PORT', PORT || 8080)
app.set('views', path.join(__dirname, 'views'))
app.set('view engine', '.hbs')
/* ------- MIDLEWARES ------- */
// app.use(morgan('dev'))
app.use(json())
app.use(urlencoded({ extended: true }))
app.use(express.static(path.join(__dirname, 'public')))
app.use(cookieParser())
app.use(sessionMongo)
app.use(flash())
// PASSPORT NECESITA QUE PRIMERO ESTE EL SESSION PORQUE HACE USO DE EL
app.use(passport.initialize())
app.use(passport.session())
app.use(compression())

/* ------- GLOBAL VAR ------- */
app.use(globalVars)

/* ------- ROUTES ------- */
app.use(indexRouter)

/* ------- VIEWS ------- */
app.engine(
  '.hbs',
  engine({
    extname: '.hbs',
    defaultLayout: 'main',
    layoutsDir: path.join(__dirname, 'views', 'layouts'),
    partialsDir: path.join(__dirname, 'views', 'partials'),
    helpers: {
      randomNumberToJSON
    }
  })
)
// ******************************( GRAPHQL || REST API) (CONTROLLERS) ****************************//
let productsControllers
let messagesControllers
console.log(config.API_CHOSEN)
if (config.API_CHOSEN === 'graphql') {
  productsControllers = productsControllersGraphql
  messagesControllers = messagesControllersGraphql
} else {
  productsControllers = ProductsControllerRest
  messagesControllers = MessagesControllerRest
}
// ****************************** PRODUCTS LIST ****************************//
io.on('connection', async (socket) => {
  try {
    logger.info('a user connected')
    // const products = await productServices.getAllProducts()
    socket.emit('products-list', await productsControllers.allProducts())

    socket.on('new-product', async (product) => {
      await productsControllers.addProduct(product)
      // const products = await productServices.getAllProducts()
      io.sockets.emit('products-list', await productsControllers.allProducts())
    })
  } catch (error) {
    logger.error(error)
  }
})
// ****************************** MESSAGE CENTER ****************************//
io.on('connection', async (socket) => {
  socket.emit('messages-list', await messagesControllers.allMessages())

  socket.on('new-message', async (message) => {
    await messagesControllers.addMessage(message)
    io.sockets.emit('messages-list', await messagesControllers.allMessages())
  })
})
// ****************************** END WEBSOCKET ****************************//
app.use(loggerNonExistent)
// ERROR HANDLER
app.use(errorHandler)
