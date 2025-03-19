import DynamoDemo from './components/DynamoDemo';

export default function Home() {
  return (
    <main className="min-h-screen p-4 md:p-8 bg-gray-100">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Next.js DynamoDB Demo</h1>
        <p className="mb-6 text-gray-600">Interact with DynamoDB through a simple API interface</p>
        
        <DynamoDemo />
      </div>
    </main>
  );
}
