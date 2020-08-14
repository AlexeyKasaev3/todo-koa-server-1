const Koa = require('koa')
const Router = require('@koa/router')
const cors = require('@koa/cors')
const mongoose = require('mongoose')
const bodyParser = require('koa-bodyparser')
const { Schema, model } = require('mongoose')

const app = new Koa()
const router = new Router()
app.use(cors())
app.use(bodyParser())

const todoSchema = new Schema({
  text: { type: String, required: true },
  isComplete: { type: Boolean, required: true },
})

const todoMongooseModel = model('todoModel', todoSchema)

mongoose.connect('mongodb://localhost:27017/test', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})

router
  .get('/todos', getAllTodos)
  .get('/todos/:id', getTodo)
  .patch('/todos/:ids', toggleTodo)
  .put('/todos/:id', editTodo)
  .post('/todos', createTodo)
  .delete('/todos/:id', deleteTodo)

app.use(router.routes())

async function getAllTodos(ctx) {
  switch (ctx.query.status) {
    case 'all':
      ctx.body = await todoMongooseModel.find({})
      break
    case 'active':
      ctx.body = await todoMongooseModel.find({ isComplete: false })
      break
    case 'completed':
      ctx.body = await todoMongooseModel.find({ isComplete: true })
      break
    default:
      ctx.body = await todoMongooseModel.find({})
  }
}

async function getTodo(ctx) {
  ctx.body = await todoMongooseModel.findById(ctx.query.id)
}

async function toggleTodo(ctx) {
  const todoIds = ctx.params.ids.split(',')
  const newTodosStatus = ctx.request.body.status
  await todoMongooseModel.update(
    { _id: { $in: todoIds } },
    { isComplete: newTodosStatus },
    { multi: true }
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
  const { text, isComplete } = ctx.request.body
  const todoMongooseObject = new todoMongooseModel({ text, isComplete })
  const newTodo = await todoMongooseObject.save()
  ctx.body = newTodo
}

async function deleteTodo(ctx) {
  ctx.body = await todoMongooseModel.findByIdAndDelete(`_{ctx.params.id}`)
}

app.listen(3000)
