const Koa = require('koa')
const Router = require('@koa/router')
const cors = require('@koa/cors')
const mongoose = require('mongoose')
const bodyParser = require('koa-bodyparser')
const { model } = require('mongoose')
const jwt = require('jsonwebtoken')

const userSchema = require('./shemas/userSchema')
const todoSchema = require('./shemas/todoSchema')

const ACCESS_TOKEN_SECRET = 'accessTokenSecret'
const REFRESH_TOKEN_SECRET = 'refreshTokenSecret'

const todoMongooseModel = model('todoModel', todoSchema)
const userMongooseModel = model('userModel', userSchema)

mongoose.connect('mongodb://localhost:27017/todos', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})

function protectPrivatePathesWithJwt() {
  return async (ctx, next) => {
    const path = ctx.request.path
    if (
      path === '/register' ||
      path === '/login' ||
      path === '/refresh_token'
    ) {
      await next()
    } else {
      const accessJwtToken = ctx.request.header.authorization
      if (!accessJwtToken) {
        return (ctx.status = 401)
      }
      try {
        const decodedJwt = jwt.verify(accessJwtToken, ACCESS_TOKEN_SECRET)
        ctx.userId = decodedJwt.userId
        await next()
      } catch (error) {
        return (ctx.status = 403)
      }
    }
  }
}

const app = new Koa()
const router = new Router()

app.use(cors())
app.use(bodyParser())
app.use(protectPrivatePathesWithJwt())

router.get('/todos', getAllTodos)
router.get('/todos/:id', getTodo)
router.patch('/todos/toggle_all', toggleTodos)
router.patch('/todos/:id', toggleTodo)
router.put('/todos/:id', editTodo)
router.post('/todos', createTodo)
router.delete('/todos/:id', deleteTodo)
router.delete('/todos_completed', deleteCompletedTodos)

router.post('/register', register)
router.post('/login', login)

router.post('/refresh_token', refreshToken)

app.use(router.routes())

async function getAllTodos(ctx) {
  switch (ctx.query.status) {
    case 'all':
      ctx.body = await todoMongooseModel.find({ userId: ctx.userId })
      break
    case 'active':
      ctx.body = await todoMongooseModel.find({
        userId: ctx.userId,
        isComplete: false,
      })
      break
    case 'completed':
      ctx.body = await todoMongooseModel.find({
        userId: ctx.userId,
        isComplete: true,
      })
      break
    default:
      ctx.body = await todoMongooseModel.find({ userId: ctx.userId })
  }
}

async function getTodo(ctx) {
  ctx.body = await todoMongooseModel.findById(ctx.query.id)
}

async function toggleTodo(ctx) {
  const todoId = ctx.params.id
  const currentTodo = await todoMongooseModel.findById(todoId).exec()
  const currentTodoStatus = currentTodo.isComplete
  await todoMongooseModel.findByIdAndUpdate(todoId, {
    isComplete: !currentTodoStatus,
  })
  ctx.status = 200
}

async function toggleTodos(ctx) {
  const todosNewStatus = ctx.request.body.status
  await todoMongooseModel.updateMany(
    { isComplete: !todosNewStatus },
    { isComplete: todosNewStatus }
  )
  ctx.status = 200
}

async function editTodo(ctx) {
  const todoId = ctx.params.id
  const { todoText } = ctx.request.body
  await todoMongooseModel.updateOne({ _id: todoId }, { text: todoText })
  ctx.status = 200
}

async function createTodo(ctx) {
  const { text, isComplete, _id } = ctx.request.body
  const todoMongooseObject = new todoMongooseModel({
    _id,
    text,
    isComplete,
    userId: ctx.userId,
  })
  await todoMongooseObject.save()
  ctx.status = 200
}

async function deleteTodo(ctx) {
  await todoMongooseModel.findByIdAndDelete(ctx.params.id)
  ctx.status = 200
}

async function deleteCompletedTodos(ctx) {
  await todoMongooseModel.deleteMany({ isComplete: true })
  ctx.status = 200
}

async function register(ctx) {
  const { userEmail, userPassword } = ctx.request.body
  const isUserAlreadyExist = await userMongooseModel
    .findOne({ email: userEmail })
    .exec()
  if (isUserAlreadyExist) {
    return (ctx.status = 401)
  }
  const userMongooseObject = new userMongooseModel({
    email: userEmail,
    password: userPassword,
  })
  const { _id: userId } = await userMongooseObject.save()
  ctx.body = {
    accessToken: generateAccessToken(userId, userEmail),
    refreshToken: generateRefreshToken(userId, userEmail),
  }
}

async function login(ctx) {
  const { userEmail, userPassword } = ctx.request.body
  const userData = await userMongooseModel
    .findOne({ email: userEmail, password: userPassword })
    .exec()
  if (userData) {
    ctx.body = {
      accessToken: generateAccessToken(userData._id, userEmail),
      refreshToken: generateRefreshToken(userData._id, userEmail),
    }
  } else {
    ctx.status = 401
    ctx.response.message = 'wrong login or password'
  }
}

async function refreshToken(ctx) {
  const refreshTokenFromUser = ctx.request.body.refreshToken
  if (!refreshTokenFromUser) return (ctx.status = 401)
  try {
    const { userId, userEmail } = jwt.verify(
      refreshTokenFromUser,
      REFRESH_TOKEN_SECRET
    )
    ctx.body = {
      accessToken: generateAccessToken(userId, userEmail),
      refreshToken: generateRefreshToken(userId, userEmail),
    }
  } catch {
    return (ctx.status = 403)
  }
}

function generateAccessToken(userId, userEmail) {
  return jwt.sign(
    { userId: userId, userEmail: userEmail },
    ACCESS_TOKEN_SECRET,
    { expiresIn: '15m' }
  )
}

function generateRefreshToken(userId, userEmail) {
  return jwt.sign({ userId, userEmail }, REFRESH_TOKEN_SECRET)
}

app.listen(3000)
