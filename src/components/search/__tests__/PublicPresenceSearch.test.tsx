import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { PublicPresenceSearch } from '../PublicPresenceSearch';
const search = vi.hoisted(() => vi.fn());
vi.mock('@/lib/publicPresence', () => ({searchPresence:search, stagePresenceClaim:vi.fn()}));
beforeEach(() => search.mockReset());
describe('pre-account discovery', () => {
  it('allows selection and preview without creating an account or merging homonyms', async () => {
    search.mockResolvedValue({profiles:[{id:'a',source:'kretopia',title:'Alex Lee',url:'/profile/a',kind:'Passport'}],web:[{id:'b',source:'web',title:'Alex Lee',url:'https://example.com/alex',kind:'Portfolio'}],localOk:true,webOk:true});
    const continueSignup = vi.fn();
    render(<MemoryRouter><PublicPresenceSearch onContinue={continueSignup}/></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('Discover your digital presence'),{target:{value:'Alex Lee'}});
    fireEvent.click(screen.getByRole('button',{name:'Find my passport'}));
    const checks = await screen.findAllByRole('checkbox');
    expect(checks).toHaveLength(2);
    fireEvent.click(checks[1]);
    fireEvent.click(screen.getByRole('button',{name:/Is this you/}));
    expect(continueSignup).not.toHaveBeenCalled();
    expect(screen.getByRole('link',{name:'Alex Lee'})).toHaveAttribute('href','https://example.com/alex');
    fireEvent.click(screen.getByRole('button',{name:'Join Kretopia'}));
    expect(continueSignup).toHaveBeenCalledTimes(1);
  });
  it('retains local results when web fails without fabricating public results', async () => {
    search.mockResolvedValue({profiles:[{id:'a',source:'kretopia',title:'Real user',url:'/profile/a',kind:'Passport'}],web:[],localOk:true,webOk:false});
    render(<MemoryRouter><PublicPresenceSearch /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('Discover your digital presence'),{target:{value:'Real user'}});
    fireEvent.click(screen.getByRole('button',{name:'Find my passport'}));
    await waitFor(() => expect(screen.getAllByRole('checkbox')).toHaveLength(1));
    expect(screen.getByRole('link',{name:'Real user'})).toHaveAttribute('href','/profile/a');
  });
});