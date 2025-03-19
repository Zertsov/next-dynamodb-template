'use client';

import { useState, useEffect } from 'react';

interface User {
  id: string;
  name?: string;
  email?: string;
  age?: number;
  createdAt?: string;
  updatedAt?: string;
  expiresAt?: number; // TTL timestamp
  [key: string]: unknown;
}

interface ExpirationInfo {
  timestamp: number;
  formattedDate: string;
}

interface ApiResponse {
  users?: User[];
  user?: User;
  items?: User[];
  updatedUser?: User;
  message?: string;
  count?: number;
  scannedCount?: number;
  operation?: string;
  explanation?: string;
  id?: string;
  note?: string;
  updateExpression?: string;
  expressionAttributeValues?: Record<string, unknown>;
  error?: string;
  expiresAt?: ExpirationInfo | null;
}

export default function DynamoDemo() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [operation, setOperation] = useState<string>('create');
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    email: '',
    age: '',
    ttl: '',
  });
  const [response, setResponse] = useState<ApiResponse | null>(null);

  // Fetch all users on component mount
  useEffect(() => {
    fetchUsers();
  }, []);

  // Fetch all users
  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/users');
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch users');
      }
      
      setUsers(data.users || []);
      setResponse(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Handle form submission for all operations
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      // Prepare the request payload based on operation
      const payload: Record<string, string | number | boolean | null> = { operation };
      
      // Add fields based on the operation
      if (operation === 'create') {
        if (!formData.name) {
          throw new Error('Name is required for create operation');
        }
        
        payload.name = formData.name;
        
        if (formData.id) payload.id = formData.id;
        if (formData.email) payload.email = formData.email;
        if (formData.age) payload.age = parseInt(formData.age);
        if (formData.ttl) payload.ttl = parseInt(formData.ttl);
      } 
      else if (['get', 'delete', 'query'].includes(operation)) {
        if (!formData.id) {
          throw new Error('ID is required for this operation');
        }
        
        payload.id = formData.id;
      } 
      else if (operation === 'update') {
        if (!formData.id) {
          throw new Error('ID is required for update operation');
        }
        
        payload.id = formData.id;
        if (formData.name) payload.name = formData.name;
        if (formData.email) payload.email = formData.email;
        if (formData.age) payload.age = parseInt(formData.age);
        
        // Handle TTL for updates - we need to allow empty string to indicate removal
        if (formData.ttl !== undefined) {
          if (formData.ttl === '') {
            // Empty string means remove TTL
            payload.ttl = null;
          } else if (formData.ttl) {
            // Non-empty string means set TTL
            payload.ttl = parseInt(formData.ttl);
          }
        }
      }
      
      // Send the request
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Operation failed');
      }
      
      // Display the response
      setResponse(data);
      
      // If the operation was successful and might have changed the data, refresh the user list
      if (['create', 'update', 'delete'].includes(operation)) {
        fetchUsers();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Handle input changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Update operation if selection changes
    if (name === 'operation') {
      setOperation(value);
    }
  };

  // Format expiration date for display
  const formatExpiration = (user: User): string => {
    if (!user.expiresAt) return 'No expiration';
    return new Date(user.expiresAt * 1000).toLocaleString();
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">DynamoDB Demo</h1>
      
      {/* Operation Form */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-8">
        <h2 className="text-xl font-semibold mb-4">Perform DynamoDB Operation</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Operation:
              <select
                name="operation"
                value={operation}
                onChange={handleChange}
                className="w-full p-2 border rounded mt-1"
              >
                <option value="create">Create User (PutItem)</option>
                <option value="get">Get User (GetItem)</option>
                <option value="query">Query User (Query)</option>
                <option value="update">Update User (UpdateItem)</option>
                <option value="delete">Delete User (DeleteItem)</option>
              </select>
            </label>
          </div>
          
          {/* Conditional form fields based on operation */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(operation === 'get' || operation === 'delete' || operation === 'query' || operation === 'update') && (
              <div>
                <label className="block text-sm font-medium mb-1">
                  ID:
                  <input
                    type="text"
                    name="id"
                    value={formData.id}
                    onChange={handleChange}
                    className="w-full p-2 border rounded mt-1"
                    required
                  />
                </label>
              </div>
            )}
            
            {(operation === 'create' || operation === 'update') && (
              <>
                {operation === 'create' && (
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      ID (optional):
                      <input
                        type="text"
                        name="id"
                        value={formData.id}
                        onChange={handleChange}
                        className="w-full p-2 border rounded mt-1"
                        placeholder="Leave empty to auto-generate"
                      />
                    </label>
                  </div>
                )}
                
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Name:
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      className="w-full p-2 border rounded mt-1"
                      required={operation === 'create'}
                    />
                  </label>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Email:
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      className="w-full p-2 border rounded mt-1"
                    />
                  </label>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Age:
                    <input
                      type="number"
                      name="age"
                      value={formData.age}
                      onChange={handleChange}
                      className="w-full p-2 border rounded mt-1"
                    />
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    TTL (seconds):
                    <input
                      type="number"
                      name="ttl"
                      value={formData.ttl}
                      onChange={handleChange}
                      className="w-full p-2 border rounded mt-1"
                      placeholder={operation === 'update' ? "Leave empty to remove TTL" : "Time to live in seconds"}
                    />
                    <span className="text-xs text-gray-500 mt-1 block">
                      {operation === 'create' 
                        ? "Item will expire after this many seconds" 
                        : "Set a new expiration time or clear to remove expiration"}
                    </span>
                  </label>
                </div>
              </>
            )}
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? 'Processing...' : 'Execute Operation'}
          </button>
        </form>
        
        {error && (
          <div className="mt-4 p-3 bg-red-100 text-red-700 rounded">
            {error}
          </div>
        )}
      </div>
      
      {/* Response Display */}
      {response && (
        <div className="bg-white p-6 rounded-lg shadow-md mb-8">
          <h2 className="text-xl font-semibold mb-4">API Response</h2>
          
          {response.expiresAt && (
            <div className="mb-4 p-3 bg-blue-50 rounded">
              <h3 className="font-medium">TTL Information</h3>
              <p>Item will expire at: <span className="font-semibold">{response.expiresAt.formattedDate}</span></p>
              <p className="text-xs text-gray-600">TTL Timestamp: {response.expiresAt.timestamp}</p>
            </div>
          )}
          
          <pre className="bg-gray-100 p-4 rounded overflow-auto max-h-60">
            {JSON.stringify(response, null, 2)}
          </pre>
        </div>
      )}
      
      {/* User List */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">User List</h2>
          <button
            onClick={fetchUsers}
            disabled={loading}
            className="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600 disabled:opacity-50"
          >
            Refresh
          </button>
        </div>
        
        {users.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Age</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expires</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {users.map((user) => (
                  <tr key={user.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{user.id}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{user.name || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{user.email || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{user.age || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{user.createdAt ? new Date(user.createdAt).toLocaleString() : '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {formatExpiration(user)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500">No users found in the database.</p>
        )}
      </div>
    </div>
  );
} 