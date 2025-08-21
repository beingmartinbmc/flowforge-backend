const axios = require('axios');

const BASE_URL = 'https://flowforge-backend-igy5vaoo1-beingmartinbmcs-projects.vercel.app/api';
const EMAIL = 'test3@example.com';
const PASSWORD = 'test@123';

let authToken = null;

async function login() {
  try {
    console.log('Logging in...');
    const response = await axios.post(`${BASE_URL}/auth/login`, {
      email: EMAIL,
      password: PASSWORD
    });
    
    authToken = response.data.token;
    console.log('✅ Login successful');
  } catch (error) {
    console.error('❌ Login failed:', error.response?.data || error.message);
    throw error;
  }
}

async function getPendingTasks() {
  try {
    console.log('Getting pending tasks...');
    
    // Get all runs
    const runsResponse = await axios.get(`${BASE_URL}/runs`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    const runs = runsResponse.data.runs;
    console.log(`Found ${runs.length} runs`);
    
    // Get tasks for each run
    const allTasks = [];
    for (const run of runs) {
      if (run.status === 'RUNNING') {
        const tasksResponse = await axios.get(`${BASE_URL}/runs/${run.id}/tasks`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const pendingTasks = tasksResponse.data.tasks.filter(task => task.status === 'PENDING');
        allTasks.push(...pendingTasks);
      }
    }
    
    console.log(`Found ${allTasks.length} pending tasks`);
    return allTasks;
  } catch (error) {
    console.error('❌ Failed to get pending tasks:', error.response?.data || error.message);
    throw error;
  }
}

async function processTask(taskId) {
  try {
    console.log(`Processing task: ${taskId}`);
    
    // Get task details
    const taskResponse = await axios.get(`${BASE_URL}/tasks/${taskId}`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    const task = taskResponse.data.task;
    console.log(`Task: ${task.nodeName} (${task.nodeType})`);
    
    // Simulate task processing based on node type
    if (task.nodeType === 'echo') {
      console.log(`✅ Echo task completed: ${task.run.workflow.nodes.find(n => n.id === task.nodeId)?.config?.message}`);
      
      // Update task status manually by creating a new task with SUCCESS status
      // This is a workaround since we can't directly update the task
      console.log('📝 Echo task would be marked as SUCCESS');
      
    } else if (task.nodeType === 'http') {
      const nodeConfig = task.run.workflow.nodes.find(n => n.id === task.nodeId)?.config;
      console.log(`🌐 HTTP task: ${nodeConfig?.method} ${nodeConfig?.url}`);
      
      // Simulate HTTP request
      try {
        const httpResponse = await axios({
          method: nodeConfig?.method || 'GET',
          url: nodeConfig?.url,
          headers: nodeConfig?.headers || {},
          timeout: nodeConfig?.timeout || 10000
        });
        
        console.log(`✅ HTTP task completed: ${httpResponse.status} ${httpResponse.statusText}`);
        console.log('📝 HTTP task would be marked as SUCCESS');
        
      } catch (httpError) {
        console.error(`❌ HTTP task failed: ${httpError.message}`);
        console.log('📝 HTTP task would be marked as FAILED');
      }
    }
    
    return { taskId, status: 'processed' };
  } catch (error) {
    console.error(`❌ Failed to process task ${taskId}:`, error.response?.data || error.message);
    return { taskId, status: 'error', error: error.message };
  }
}

async function main() {
  try {
    console.log('🚀 Starting manual task processing...\n');
    
    // Login
    await login();
    
    // Get pending tasks
    const pendingTasks = await getPendingTasks();
    
    if (pendingTasks.length === 0) {
      console.log('✅ No pending tasks found');
      return;
    }
    
    // Process each pending task
    console.log(`\n🔄 Processing ${pendingTasks.length} pending tasks...\n`);
    
    for (const task of pendingTasks) {
      await processTask(task.id);
      console.log('---');
    }
    
    console.log('\n✅ Manual task processing completed!');
    console.log('\n📋 Summary:');
    console.log(`- User: ${EMAIL}`);
    console.log(`- Pending tasks processed: ${pendingTasks.length}`);
    console.log('\n💡 Note: This is a simulation. To fully process tasks, deploy the scheduler endpoints.');
    
  } catch (error) {
    console.error('\n❌ Task processing failed:', error.message);
  }
}

main();
