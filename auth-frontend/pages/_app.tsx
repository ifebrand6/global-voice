import 'bootstrap/dist/css/bootstrap.min.css';
import { ApolloProvider } from "@apollo/client";
import client from "../lib/apolloClient";
import { AppProps } from 'next/app'; // Import AppProps from Next.js

function MyApp({ Component, pageProps }: AppProps) {
    return (
        <ApolloProvider client={client}>
            <Component {...pageProps} />
        </ApolloProvider>
    );
}

export default MyApp
