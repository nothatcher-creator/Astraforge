import {createRoot} from 'react-dom/client';
import Editor from '../components/editor/Editor';
import '../app/globals.css';
import '../app/phone.css';
import '../app/catalog.css';

createRoot(document.getElementById('root')!).render(<Editor/>);
