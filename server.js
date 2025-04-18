const http = require('http');
const fs = require('fs').promises; //Use the Promises API of fs
const url = require('url');
const EventEmitter = require('events');

//Create instance of EventEmitter
const logs = new EventEmitter();

logs.on('log', (message) => {
    const timeStamp = new Date().toLocaleString(); //To get a more human-readable timestamp.
    fs.appendFile('logs.txt', `${timeStamp} - ${message}\n`, err => {
        if (err) console.error('Logging failed:', err);
    });
});

//Functions
async function readTodos() {
    try {
        const content = await fs.readFile('todos.json', 'utf8'); //Read file asynchronously
        return JSON.parse(content); //Parse and return JSON content
    } catch (err) {
        console.error('Error reading file:', err); //Throw error for proper handling
    }
}

async function getTodoById(id) {
    const todos = await readTodos(); // Reads the todos
    const todo = todos.find(todo_1 => todo_1.id === id); //Find the todo by ID
    if (todo) {
        return todo; //Return the found todo
    } else {
        throw new Error(`Todo id not found`, err); //Throw error if no todo matches
    }
}

async function createTodo(newTodo) {
    try {
        const todos = await readTodos(); //Load existing todos
        const lastId = todos.length > 0 ? todos[todos.length - 1].id : 0; //Get the last id
        const todo = {
            id: lastId + 1, //Generate unique ID
            title: newTodo.title, //Title from user input
            completed: newTodo.completed || false //Default status
        };

        todos.push(todo); //Add the new todo to the array

        //Save the updated todos list back to the file
        await fs.writeFile('todos.json', JSON.stringify(todos, null, 2));
        return todo; //Return the newly created todo

    } catch (err) {
        throw new Error('Error creating todo:', err)
    }
}

async function updateTodo(id, updates) {
    try {
        const todos = await readTodos(); //Load existing todos
        const index = todos.findIndex(todo => todo.id === id); //Find the index of the todo by id

        if (index === -1) {
            throw new Error('Todo id not found');
        }

        // Update the todo with the provided updates
        todos[index] = { ...todos[index], ...updates };

        //Save the updated todos list back to the file
        await fs.writeFile('todos.json', JSON.stringify(todos, null, 2));
        return todos[index]; //Return the updated todo

    } catch (err) {
        throw new Error('Error updating todo:', err.message);
    }
}

async function deleteTodo(id) {
    try {
        const todos = await readTodos(); //Load existing todos
        const index = todos.findIndex(todo => todo.id === id); //Find todo index by id

        if (index === -1) {
            throw new Error('Todo id not found'); // Throw error if todo not found
        }

        //Remove the todo by its index
        const removedTodo = todos.splice(index, 1)[0];
        
        //Save updated todos back to the file
        await fs.writeFile('todos.json', JSON.stringify(todos, null, 2));
        return removedTodo; //Return the deleted todo

    } catch (err) {
        throw new Error('Error deleting todo:', err.message);
    }
}



const server = http.createServer((req, res) => {
    
    if (req.url === '/todos' && req.method === 'GET') { 
        
        logs.emit('log', `${req.method} - ${req.url}`)

        readTodos()
        .then(todos => {
            res.writeHead(200, { 'Content-Type' : 'application/json' }); //Send a success response
            res.end(JSON.stringify(todos)); //Send the all todos to the client
        })
        .catch(err => {
            console.error('Failed to read todos:', err.message);
            res.statusCode = 500; //Handle errors
            res.end('Failed to read todos');
        }); 
    } 

    else if (req.url.startsWith('/todos/') && req.method === 'GET') {

        logs.emit('log', `${req.method} - ${req.url}`)

        const query = url.parse(req.url, true).query; //Parse the query parameters 
        const id = parseInt(query.id); //Extract `id` parameter

        if (isNaN(id)) {
            res.writeHead(400, {'Content-Type' : 'text/plain' });
            res.end('Invalid id');
            return;
        }

        getTodoById(id)
            .then(todo => {
                res.writeHead(200, { 'Content-Type' : 'application/json' });
                res.end(JSON.stringify(todo)); //Send the specific todo
            })
            .catch(err => {
                console.error('Failed to fetch todo:', err.message);
                res.statusCode = 500;
                res.end('Failed to read todo');
            });
    }

    else if (req.url === '/todos' && req.method === 'POST') {

        logs.emit('log', `${req.method} - ${req.url}`)

        let body = '';

        //Collect the incoming request body data
        req.on('data', chunk => {
            body += chunk.toString(); //Append chunks of data
        })

        req.on('end', () => {
            try {
                const parsedBody = JSON.parse(body); //Parse JSON body
                const title = parsedBody.title; //Extract the title from request

                if (!title) {
                    res.writeHead(400, {'Content-Type' : 'text/plain' });
                    res.end('Invalid title');
                    return;
                }

                //Create new todo object
                const newTodo = { title: title, completed: parsedBody.completed || false };
                
                createTodo(newTodo) 
                    .then(todo => {
                        res.writeHead(200, { 'Content-Type' : 'application/json' });
                        res.end(JSON.stringify(todo)); //Return the newly created todo  
                    })
                    .catch(err => {
                        console.error('Failed to create newtodo:', err.message);
                        res.statusCode = 500;
                        res.end('Failed to create newtodo');
                    });
                    
            } catch (err) {
                console.error('Error parsing request body:', err.message);
                res.statusCode = 400;
                res.end('Invalid request body');
            }
        })

    }

    else if (req.url.startsWith('/todos/') && req.method === 'PUT') {

        logs.emit('log', `${req.method} - ${req.url}`)

        const query = url.parse(req.url, true).query; //Parse the query parameters 
        const id = parseInt(query.id); ////Extract the `id` parameter

        if (isNaN(id)) {
            res.writeHead(400, {'Content-Type' : 'text/plain' });
            res.end('Invalid id');
            return; //Stop further execution if ID is valid
        }
        
        let body = '';

        //Collect data from the request body 
        req.on('data', (chunk) => {
            body += chunk; //Convert Buffer to string and append to the body
        });

        req.on('end', async () => {
            try {
                const updates = JSON.parse(body); //Parse JSON body

                if(!updates.title) {
                    res.writeHead(400, { 'Content-Type' : 'application/json' });
                    return res.end(JSON.stringify({ error: 'Title is requireed' }));
                }

                try {
                    const updatedTodo = await updateTodo(id, updates); //Call the updateTodo function
                    res.writeHead(200, { 'Content-Type' : 'application/json' });
                    res.end(JSON.stringify(updatedTodo));
                } catch (err) {
                    console.error('Failed to update todo:', err.message);
                    res.statusCode = 404;
                    res.end(JSON.stringify({ error: err.message }));
                }

            } catch (err) {
                console.error('Error parsing JSON in Put request', err);
                res.statusCode = 400;
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
        });

        req.on('error', err => {
            console.error('Error receiving request data:', err.message);
            res.statusCode = 500;
            res.end('Failed to process request');
        });
    }

    else if (req.url.startsWith('/todos/') && req.method === 'DELETE') {

        logs.emit('log', `${req.method} - ${req.url}`)

        const query = url.parse(req.url, true).query; //Parse the query parameters 
        const id = parseInt(query.id); //Extract `id` parameter

        if (isNaN(id)) {
            res.writeHead(400, {'Content-Type' : 'text/plain' });
            res.end('Invalid id');
            return; //Stop further execution if ID is valid
        }  
        
        deleteTodo(id)
        .then(removedTodo => {
            res.writeHead(200, { 'Content-Type' : 'application/json' });
            res.end(JSON.stringify(removedTodo)); //Return the deleted todo
        })
        .catch(err => {
            console.error('Failed to delete todo:', err.message);

            if(err.message.includes('not found')) {
                res.statusCode = 404;
                res.end(JSON.stringify({ error: 'Todo not found' }));
            } else {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: 'Failed to delete todo' })); //Internal server error
            }
        });  
    }

    else {
        res.statusCode = 404; // Handle unknown routes
        res.end('Endpoint not found')
    }

});

server.listen(3000, 'localhost', () => {
    console.log('Server running at http://localhost:3000/')
});