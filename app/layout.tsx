import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'Dispatch — Driver Desk',description:'Your team, your shifts, your deliveries. One clear workspace.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en-IE"><body>{children}</body></html>}
