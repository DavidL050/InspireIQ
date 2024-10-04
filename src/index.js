import express from 'express'
import {dirname, join} from 'path'
import { fileURLToPath } from 'url'

import indexRoutes from './routes/index.js'
import db from './db/database.js'

const app = express()
app.use(express.json());
app.use(express.urlencoded({extended: true}));

const __dirname = dirname(fileURLToPath(import.meta.url))



app.set('views', join(__dirname,'views'))
app.set('view engine', 'ejs')
app.use(indexRoutes)

app.use(express.static(join(__dirname, 'public')));


app.listen(4000)
console.log('Server', 4000) 
