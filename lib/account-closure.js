import { deleteUser } from 'firebase/auth'
import { auth } from './firebase'
import { marketApi } from './market-api'
import { createClosureRunner } from './closure-runner.mjs'
export const finishAccountClosure = createClosureRunner({ currentUser: () => auth.currentUser, callApi: marketApi, deleteLogin: deleteUser })
