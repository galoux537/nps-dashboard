import NpsTable from './components/NpsTable.vue'
import api from './plugins/axios'

export default {
  install: (app) => {
    app.component('NpsTable', NpsTable)
  }
}

export { api } 