const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function updateClientActiveStatus() {
  try {
    console.log('Updating client active status...');
    
    // Update all clients with null isActive to true
    const result = await prisma.client.updateMany({
      where: {
        isActive: {
          equals: null
        }
      },
      data: {
        isActive: true
      }
    });
    
    console.log(`Updated ${result.count} clients with null isActive to true`);
    
    // Show current status
    const activeClients = await prisma.client.count({
      where: { isActive: true }
    });
    
    const inactiveClients = await prisma.client.count({
      where: { isActive: false }
    });
    
    const nullClients = await prisma.client.count({
      where: { 
        isActive: {
          equals: null
        }
      }
    });
    
    console.log('\nCurrent client status:');
    console.log(`- Active clients: ${activeClients}`);
    console.log(`- Inactive clients: ${inactiveClients}`);
    console.log(`- Null isActive: ${nullClients}`);
    
  } catch (error) {
    console.error('Error updating client active status:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateClientActiveStatus(); 