import React, { useState, useEffect } from 'react'

import { config, useFetch } from '../src'

config({
  baseURL: 'https://jsonplaceholder.typicode.com',
})


const TodoItem = () => {
  const { loading, data: todo } = useFetch('/todos/1')
  if (loading) return <div>loading....</div>

  return (
    <div>
      <pre>{JSON.stringify(todo, null, 2)}</pre>
    </div>
  )
}

const ReuseTodoItem = () => {
  const { loading, data: todo } = useFetch('/todos/1')
  if (loading) return <div>loading....</div>

  return (
    <div>
      <div>ReuseTodoItem:</div>
      <pre>{JSON.stringify(todo, null, 2)}</pre>
    </div>
  )
}

export default () => (
  <div>
    <TodoItem></TodoItem>
    <ReuseTodoItem></ReuseTodoItem>
  </div>
)
