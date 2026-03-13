import { SignIn } from '@clerk/nextjs'
import React from 'react'

function page() {
  return (
    <SignIn/>
  )
}
export default page
// here we will how now create some of public route and private route 
// we dont want auth folder as route so we wrap this folder into () so next js not consider it as route we can acess sign-in just by typing /sign-in other wise we have to write /auth/sing-in
// now here we craete an folder as catch a route folder and add our page.jsx in it 
// by this we will able to add clerk sign in component or any other component as per our need
// catch all route folder allow us to add multiple route in single file like we can add http://localhost:3000/sign-in iske baad bhi ham / laga ke more route laga sajte hai like /sign part 