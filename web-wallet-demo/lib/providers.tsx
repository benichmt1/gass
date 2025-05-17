'use client';

import { DynamicContextProvider } from "@dynamic-labs/sdk-react-core";
import { EthereumWalletConnectors } from "@dynamic-labs/ethereum";
// import { ZeroDevSmartWalletConnectors } from "@dynamic-labs/ethereum-aa"; // Commented out for MetaMask focus
import { TogglesProvider } from "@/app/components/HeaderToggles";
// import { baseSepolia } from "viem/chains";
// import { useTheme } from "react-jss";

export default function Providers({
  children,
}: {
  children: React.ReactNode;
}) {
  // const { theme } = useTheme();

  return (
    <TogglesProvider>
      <DynamicContextProvider
        theme="auto"
        settings={{
          environmentId: process.env.NEXT_PUBLIC_DYNAMIC_ENV_ID || "83b7454d-83ea-4b76-8532-2b4e3dd6f1a4",
          walletConnectors: [
            EthereumWalletConnectors,
            // ZeroDevSmartWalletConnectors, // Commented out for MetaMask focus
          ],
          socialProvidersFilter: (providers) => ['github'],
          
          embeddedWallets: {
            enabled: true, 
            walletConnectEnabled: true,
            createOnLogin: true,
            network: { 
              chainId: 84532,
              name: "BaseSepolia",
              displayName: "Base Sepolia",
              rpcUrls: ["https://84532.rpc.thirdweb.com"],
              blockExplorerUrls: ["https://sepolia-explorer.base.org"],
              nativeCurrency: {
                name: "Sepolia Ether",
                symbol: "ETH",
                decimals: 18,
              },
              isTestnet: true, 
            },
          },
          defaultEvmNetwork: "84532",
          
          // smartWalletOptions: { // Commented out for MetaMask focus
          //   enabled: true,
          //   provider: 'zerodev',
          //   network: { 
          //     chainId: 84532,
          //     name: "BaseSepolia",
          //     displayName: "Base Sepolia",
          //     rpcUrls: ["https://84532.rpc.thirdweb.com"],
          //     blockExplorerUrls: ["https://sepolia-explorer.base.org"],
          //     nativeCurrency: {
          //       name: "Sepolia Ether",
          //       symbol: "ETH",
          //       decimals: 18,
          //     },
          //     isTestnet: true, 
          //   },
          // },

          // Temporarily comment out networkConfigurations
          // networkConfigurations: {
          //   enableNetworkView: true,
          //   displayNetworkName: true,
          //   displayBalance: true,
          //   initialState: "connected",
          //   lockToNetwork: 84532,
          //   autoSwitch: true,
          //   preventNetworkSwitching: true,
          // },

          // Temporarily comment out storageOptions
          // storageOptions: {
          //   storageType: 'localStorage',
          //   storagePrefix: 'gass_',
          //   fallbackStorageOptions: [
          //     { storageType: 'sessionStorage' },
          //     { storageType: 'memory' }
          //   ],
          //   ignoreStorageErrors: true,
          //   network: {
          //     chainId: 84532,
          //     name: 'Base Sepolia',
          //     rpcUrl: 'https://84532.rpc.thirdweb.com',
          //   },
          // },

          overrides: {
            evmNetworks: [
              {
                chainId: 84532, 
                networkId: 84532, 
                name: "BaseSepolia",
                chainName: "Base Sepolia",
                vanityName: "Base Sepolia",
                rpcUrls: ["https://84532.rpc.thirdweb.com"],
                blockExplorerUrls: ["https://sepolia-explorer.base.org"],
                iconUrls: ["https://sepolia.base.org/favicon.svg"],
                nativeCurrency: {
                  name: "Sepolia Ether",
                  symbol: "ETH",
                  decimals: 18,
                },
                isTestnet: true, 
              }
            ]
          }
        }}
      >
        {children}
      </DynamicContextProvider>
    </TogglesProvider>
  );
}