import { useState, useEffect } from 'react';

const SimpleTest = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('http://localhost:8002/api/issues')
      .then(response => response.json())
      .then(data => {
        console.log('Test data:', data);
        setData(data);
        setLoading(false);
      })
      .catch(error => {
        console.error('Test error:', error);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div>Loading test...</div>;
  }

  return (
    <div style={{ padding: '20px' }}>
      <h1>Simple Test Page</h1>
      <h2>API Response:</h2>
      <pre style={{ background: '#f5f5f5', padding: '10px', overflow: 'auto' }}>
        {JSON.stringify(data, null, 2)}
      </pre>
      
      {data && data.data && (
        <div>
          <h2>Issues ({data.count}):</h2>
          {data.data.map((issue, index) => (
            <div key={index} style={{ border: '1px solid #ccc', margin: '10px 0', padding: '10px' }}>
              <h3>{issue.title}</h3>
              <p>{issue.description}</p>
              <p><strong>Status:</strong> {issue.status}</p>
              <p><strong>Category:</strong> {issue.category}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SimpleTest;