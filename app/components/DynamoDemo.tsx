'use client';

import { useState, useEffect } from 'react';

interface Item {
  userId: string;  // Partition key
  sk: string;      // Sort key
  name?: string;
  email?: string;
  age?: number;
  createdAt?: string;
  updatedAt?: string;
  expiresAt?: number; // TTL timestamp
  itemType?: string;  // PROFILE, DETAIL, ACTIVITY
  detailType?: string;
  activityType?: string;
  description?: string;
  [key: string]: unknown;
}

interface ExpirationInfo {
  timestamp: number;
  formattedDate: string;
}

interface ApiResponse {
  item?: Item;
  items?: Item[];
  message?: string;
  count?: number;
  scannedCount?: number;
  operation?: string;
  explanation?: string;
  key?: { userId: string; sk: string };
  note?: string;
  updateExpression?: string;
  expressionAttributeValues?: Record<string, unknown>;
  error?: string;
  expiresAt?: ExpirationInfo | null;
  parameters?: Record<string, string>;
}

export default function DynamoDemo() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [operation, setOperation] = useState<string>('createProfile');
  const [formData, setFormData] = useState({
    userId: '',
    sk: '',
    name: '',
    email: '',
    age: '',
    ttl: '',
    detailType: '',
    activityType: '',
    description: '',
    skPrefix: '',
  });
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [viewMode, setViewMode] = useState<string>('all');

  // Fetch all items on component mount
  useEffect(() => {
    fetchItems();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch items based on view mode and filters
  const fetchItems = async () => {
    setLoading(true);
    setError(null);
    
    try {
      let url = '/api/users';
      
      // Add query parameters based on view mode and filters
      if (viewMode === 'byUser' && formData.userId) {
        url += `?userId=${encodeURIComponent(formData.userId)}`;
        if (formData.skPrefix) {
          url += `&skPrefix=${encodeURIComponent(formData.skPrefix)}`;
        }
      } else if (viewMode === 'bySort' && formData.skPrefix) {
        url += `?queryType=bySort&skPrefix=${encodeURIComponent(formData.skPrefix)}`;
      }
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch items');
      }
      
      setItems(data.items || []);
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
      switch (operation) {
        case 'createProfile': {
          if (!formData.name) {
            throw new Error('Name is required for creating a profile');
          }
          
          payload.name = formData.name;
          
          if (formData.userId) payload.userId = formData.userId;
          if (formData.sk) payload.sk = formData.sk;
          if (formData.email) payload.email = formData.email;
          if (formData.age) payload.age = parseInt(formData.age);
          if (formData.ttl) payload.ttl = parseInt(formData.ttl);
          break;
        }
        
        case 'addDetail': {
          if (!formData.userId) {
            throw new Error('User ID is required for adding details');
          }
          
          if (!formData.detailType) {
            throw new Error('Detail type is required');
          }
          
          payload.userId = formData.userId;
          payload.detailType = formData.detailType;
          
          if (formData.description) payload.description = formData.description;
          if (formData.ttl) payload.ttl = parseInt(formData.ttl);
          break;
        }
        
        case 'addActivity': {
          if (!formData.userId) {
            throw new Error('User ID is required for adding activity');
          }
          
          if (!formData.activityType) {
            throw new Error('Activity type is required');
          }
          
          payload.userId = formData.userId;
          payload.activityType = formData.activityType;
          
          if (formData.description) payload.description = formData.description;
          if (formData.ttl) payload.ttl = parseInt(formData.ttl);
          break;
        }
        
        case 'get': {
          if (!formData.userId || !formData.sk) {
            throw new Error('Both User ID and Sort Key are required for this operation');
          }
          
          payload.userId = formData.userId;
          payload.sk = formData.sk;
          break;
        }
        
        case 'queryUser': {
          if (!formData.userId) {
            throw new Error('User ID is required for querying user items');
          }
          
          payload.userId = formData.userId;
          if (formData.skPrefix) payload.skPrefix = formData.skPrefix;
          break;
        }
        
        case 'queryBySort': {
          if (!formData.skPrefix) {
            throw new Error('Sort key prefix is required for this query');
          }
          
          payload.skPrefix = formData.skPrefix;
          break;
        }
        
        case 'update': {
          if (!formData.userId || !formData.sk) {
            throw new Error('Both User ID and Sort Key are required for updates');
          }
          
          payload.userId = formData.userId;
          payload.sk = formData.sk;
          
          if (formData.name) payload.name = formData.name;
          if (formData.email) payload.email = formData.email;
          if (formData.age && !isNaN(parseInt(formData.age))) {
            payload.age = parseInt(formData.age);
          }
          if (formData.description) payload.description = formData.description;
          
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
          break;
        }
        
        case 'delete': {
          if (!formData.userId || !formData.sk) {
            throw new Error('Both User ID and Sort Key are required for deletion');
          }
          
          payload.userId = formData.userId;
          payload.sk = formData.sk;
          break;
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
      
      // If the operation was successful and might have changed the data, refresh the item list
      if (['createProfile', 'addDetail', 'addActivity', 'update', 'delete'].includes(operation)) {
        fetchItems();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Handle input changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Update operation if selection changes
    if (name === 'operation') {
      setOperation(value);
      // Reset certain fields when changing operations
      if (['createProfile', 'addDetail', 'addActivity'].includes(value)) {
        setFormData(prev => ({ 
          ...prev, 
          sk: '', // Clear sort key since it will be generated
        }));
      }
    }
  };

  // Format expiration date for display
  const formatExpiration = (item: Item): string => {
    if (!item.expiresAt) return 'No expiration';
    return new Date(item.expiresAt * 1000).toLocaleString();
  };

  // Get sort key type color
  const getSortKeyColor = (sk: string): string => {
    if (sk.startsWith('PROFILE')) return 'bg-blue-100 text-blue-800';
    if (sk.startsWith('DETAIL')) return 'bg-green-100 text-green-800';
    if (sk.startsWith('ACTIVITY')) return 'bg-purple-100 text-purple-800';
    return 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="max-w-6xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-2">DynamoDB Composite Key Demo</h1>
      <p className="text-gray-600 mb-6">
        Demonstrating partition key + sort key usage patterns in DynamoDB
      </p>
      
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
                <option value="createProfile">Create User Profile</option>
                <option value="addDetail">Add User Detail</option>
                <option value="addActivity">Add User Activity</option>
                <option value="get">Get Item (by composite key)</option>
                <option value="queryUser">Query User Items</option>
                <option value="queryBySort">Query by Sort Key (GSI)</option>
                <option value="update">Update Item</option>
                <option value="delete">Delete Item</option>
              </select>
            </label>
          </div>
          
          {/* Conditional form fields based on operation */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* User ID field - required for most operations */}
            {(operation !== 'queryBySort') && (
              <div>
                <label className="block text-sm font-medium mb-1">
                  User ID {operation === 'createProfile' ? '(optional)' : '(required)'}:
                  <input
                    type="text"
                    name="userId"
                    value={formData.userId}
                    onChange={handleChange}
                    className="w-full p-2 border rounded mt-1"
                    placeholder={operation === 'createProfile' ? "Leave empty to auto-generate" : "User partition key"}
                    required={operation !== 'createProfile'}
                  />
                </label>
              </div>
            )}
            
            {/* Sort Key field - for operations that need the exact sort key */}
            {(['get', 'update', 'delete'].includes(operation)) && (
              <div>
                <label className="block text-sm font-medium mb-1">
                  Sort Key (required):
                  <input
                    type="text"
                    name="sk"
                    value={formData.sk}
                    onChange={handleChange}
                    className="w-full p-2 border rounded mt-1"
                    placeholder="e.g., PROFILE#2023-01-01T..."
                    required
                  />
                </label>
              </div>
            )}
            
            {/* Sort Key Prefix - for query operations */}
            {(['queryUser', 'queryBySort'].includes(operation)) && (
              <div className={operation === 'queryBySort' ? "col-span-2" : ""}>
                <label className="block text-sm font-medium mb-1">
                  Sort Key Prefix {operation === 'queryBySort' ? '(required)' : '(optional)'}:
                  <input
                    type="text"
                    name="skPrefix"
                    value={formData.skPrefix}
                    onChange={handleChange}
                    className="w-full p-2 border rounded mt-1"
                    placeholder="e.g., PROFILE, DETAIL#address, ACTIVITY#login"
                    required={operation === 'queryBySort'}
                  />
                  <span className="text-xs text-gray-500 mt-1 block">
                    Filter items by sort key pattern (e.g., PROFILE, DETAIL#address)
                  </span>
                </label>
              </div>
            )}
            
            {/* Fields for createProfile operation */}
            {operation === 'createProfile' && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Name (required):
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      className="w-full p-2 border rounded mt-1"
                      required
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
              </>
            )}
            
            {/* Fields for addDetail operation */}
            {operation === 'addDetail' && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Detail Type (required):
                    <input
                      type="text"
                      name="detailType"
                      value={formData.detailType}
                      onChange={handleChange}
                      className="w-full p-2 border rounded mt-1"
                      placeholder="e.g., address, payment, preference"
                      required
                    />
                    <span className="text-xs text-gray-500 mt-1 block">
                      Categorizes the type of detail (will be used in sort key)
                    </span>
                  </label>
                </div>
                
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1">
                    Description:
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleChange}
                      className="w-full p-2 border rounded mt-1"
                      rows={2}
                      placeholder="Add any additional information here"
                    />
                  </label>
                </div>
              </>
            )}
            
            {/* Fields for addActivity operation */}
            {operation === 'addActivity' && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Activity Type (required):
                    <input
                      type="text"
                      name="activityType"
                      value={formData.activityType}
                      onChange={handleChange}
                      className="w-full p-2 border rounded mt-1"
                      placeholder="e.g., login, purchase, view"
                      required
                    />
                    <span className="text-xs text-gray-500 mt-1 block">
                      Categorizes the type of activity (will be used in sort key)
                    </span>
                  </label>
                </div>
                
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1">
                    Description:
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleChange}
                      className="w-full p-2 border rounded mt-1"
                      rows={2}
                      placeholder="Add any additional information here"
                    />
                  </label>
                </div>
              </>
            )}
            
            {/* Fields for update operation */}
            {operation === 'update' && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Name:
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      className="w-full p-2 border rounded mt-1"
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
                
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1">
                    Description:
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleChange}
                      className="w-full p-2 border rounded mt-1"
                      rows={2}
                    />
                  </label>
                </div>
              </>
            )}
            
            {/* TTL field for operations that support it */}
            {['createProfile', 'addDetail', 'addActivity', 'update'].includes(operation) && (
              <div className={operation !== 'update' ? "col-span-2" : ""}>
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
                    {operation === 'update' 
                      ? "Set a new expiration time or clear to remove expiration" 
                      : "Item will expire after this many seconds"}
                  </span>
                </label>
              </div>
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
          
          {response.explanation && (
            <div className="mb-4 p-3 bg-yellow-50 rounded border border-yellow-200">
              <h3 className="font-medium text-yellow-800">Explanation</h3>
              <p className="text-yellow-700">{response.explanation}</p>
            </div>
          )}
          
          {response.expiresAt && (
            <div className="mb-4 p-3 bg-blue-50 rounded">
              <h3 className="font-medium">TTL Information</h3>
              <p>Item will expire at: <span className="font-semibold">{response.expiresAt.formattedDate}</span></p>
              <p className="text-xs text-gray-600">TTL Timestamp: {response.expiresAt.timestamp}</p>
            </div>
          )}
          
          <pre className="bg-gray-100 p-4 rounded overflow-auto max-h-80">
            {JSON.stringify(response, null, 2)}
          </pre>
        </div>
      )}
      
      {/* Item List with View Controls */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="flex flex-wrap justify-between items-center mb-4 gap-2">
          <h2 className="text-xl font-semibold">Items in DynamoDB</h2>
          
          <div className="flex flex-wrap items-center gap-2">
            {/* View mode selector */}
            <select
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value)}
              className="p-2 border rounded text-sm"
            >
              <option value="all">View All Items</option>
              <option value="byUser">Filter by User ID</option>
              <option value="bySort">Filter by Sort Key</option>
            </select>
            
            {/* Input for filter value */}
            {viewMode === 'byUser' && (
              <input
                type="text"
                value={formData.userId}
                onChange={(e) => setFormData(prev => ({ ...prev, userId: e.target.value }))}
                placeholder="Enter User ID"
                className="p-2 border rounded text-sm"
              />
            )}
            
            {(viewMode === 'byUser' || viewMode === 'bySort') && (
              <input
                type="text"
                value={formData.skPrefix}
                onChange={(e) => setFormData(prev => ({ ...prev, skPrefix: e.target.value }))}
                placeholder={viewMode === 'byUser' ? "Sort Key Prefix (optional)" : "Sort Key Prefix"}
                className="p-2 border rounded text-sm"
              />
            )}
            
            <button
              onClick={fetchItems}
              disabled={loading}
              className="bg-green-500 text-white px-3 py-2 rounded text-sm hover:bg-green-600 disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </div>
        
        {items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User ID
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Sort Key
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Item Type
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Details
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created At
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Expires
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {items.map((item, index) => (
                  <tr key={`${item.userId}-${item.sk}-${index}`} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.userId}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getSortKeyColor(item.sk)}`}>
                        {item.sk}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.itemType || '-'}
                      {item.detailType && <span className="ml-1 text-xs">({item.detailType})</span>}
                      {item.activityType && <span className="ml-1 text-xs">({item.activityType})</span>}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                      {item.name && <div><span className="font-medium">Name:</span> {item.name}</div>}
                      {item.email && <div><span className="font-medium">Email:</span> {item.email}</div>}
                      {item.age && <div><span className="font-medium">Age:</span> {item.age}</div>}
                      {item.description && <div><span className="font-medium">Description:</span> {item.description}</div>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.createdAt ? new Date(item.createdAt).toLocaleString() : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatExpiration(item)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500">No items found in the database.</p>
        )}
      </div>
    </div>
  );
} 