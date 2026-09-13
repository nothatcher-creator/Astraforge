'use client';
import {MonitorPlay,Quote,Music2,SlidersHorizontal,MoreHorizontal,Type,LayoutGrid,Sparkles,Shapes,Settings2,Keyboard,Maximize2,Minimize2,Globe} from 'lucide-react';
import {DropdownMenu,DropdownMenuContent,DropdownMenuItem,DropdownMenuSeparator,DropdownMenuTrigger} from '@/components/ui/dropdown-menu';

export type PhoneView = 'editor' | 'preview' | 'style';

export function PhoneNavigation({panel,onPanel,onSettings,onHelp,onCatalog}:{panel:string;onPanel:(panel:string)=>void;onSettings:()=>void;onHelp:()=>void;onCatalog:()=>void}) {
  const extra=[{id:'text',label:'Extra text',Icon:Type},{id:'presets',label:'Genre presets',Icon:LayoutGrid},{id:'effects',label:'Effects',Icon:Sparkles},{id:'elements',label:'Elements & visualizers',Icon:Shapes}];
  return <nav className="phone-navigation" aria-label="Phone workspace">
    {[{id:'preview',label:'Preview',Icon:MonitorPlay},{id:'lyrics',label:'Lyrics',Icon:Quote},{id:'media',label:'Media',Icon:Music2},{id:'style',label:'Style',Icon:SlidersHorizontal}].map(({id,label,Icon})=><button key={id} aria-pressed={panel===id} onClick={()=>onPanel(id)}><Icon size={20}/><span>{label}</span></button>)}
    <DropdownMenu><DropdownMenuTrigger className={extra.some(p=>p.id===panel)?'active':''} aria-label="More editor tools"><MoreHorizontal size={21}/><span>More</span></DropdownMenuTrigger><DropdownMenuContent side="top" align="end" sideOffset={10} className="phone-tools-menu">
      <DropdownMenuItem onSelect={onCatalog}><Globe/>Online catalog</DropdownMenuItem><DropdownMenuSeparator/>{extra.map(({id,label,Icon})=><DropdownMenuItem key={id} onSelect={()=>onPanel(id)}><Icon/>{label}</DropdownMenuItem>)}
      <DropdownMenuSeparator/><DropdownMenuItem onSelect={onSettings}><Settings2/>Project settings</DropdownMenuItem><DropdownMenuItem onSelect={onHelp}><Keyboard/>Shortcuts & help</DropdownMenuItem>
    </DropdownMenuContent></DropdownMenu>
  </nav>;
}

export function PhonePanelHeader({panel,expanded,onExpand}:{panel:string;expanded:boolean;onExpand:()=>void}) {
  const names:Record<string,string>={lyrics:'Lyrics',media:'Media library',style:'Style & properties',text:'Extra text',presets:'Genre presets',effects:'Effects',elements:'Elements'};
  return <div className="phone-panel-header"><strong>{names[panel]||'Editor'}</strong><button onClick={onExpand} aria-expanded={expanded} aria-label={expanded?'Restore preview and timeline':'Expand editing panel'}>{expanded?<Minimize2 size={15}/>:<Maximize2 size={15}/>}<span>{expanded?'Restore':'Expand'}</span></button></div>;
}
