import { ApolloClient, InMemoryCache, HttpLink } from '@apollo/client';

const httpLink = new HttpLink({
  uri: 'http://localhost:5000/graphql',
  credentials: 'include',
  // fetchOptions: {
  //   method: 'GET',
  // },
  fetch: async (uri, options) => {
    console.log('Fetching:', { uri, options });
    try {
      const response = await fetch(uri, options);
      console.log('Response:', {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers ? Array.from(response.headers.entries()) : 'No headers',
      });
      return response;
    } catch (err) {
      console.error('AAFetch error:', err);
      throw err;
    }
  },
});

const client = new ApolloClient({
  link: httpLink,
  cache: new InMemoryCache(),
});

export default client;
