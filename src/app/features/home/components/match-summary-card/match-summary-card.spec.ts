import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { MatchSummaryCard } from './match-summary-card';

describe('MatchSummaryCard', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [MatchSummaryCard], providers: [provideRouter([])] });
  });

  it('labels an OPEN per-player amount as estimated', () => {
    const fixture = create('OPEN', 10, 500_000);

    expect(fixture.nativeElement.textContent).toContain('10 confirmados');
    expect(fixture.nativeElement.textContent).toContain('Estimado por jugador');
    expect(fixture.nativeElement.textContent).toContain('5.000');
    expect(fixture.nativeElement.textContent).toContain('puede cambiar');
  });

  it('does not render an invalid amount with zero confirmations', () => {
    const fixture = create('OPEN', 0, null);

    expect(fixture.nativeElement.textContent).toContain('Esperando confirmaciones');
    expect(fixture.nativeElement.textContent).not.toContain('Infinity');
    expect(fixture.nativeElement.textContent).not.toContain('NaN');
  });

  it('keeps DRAFT closed and SETTLEMENT separate from final financial truth', () => {
    const draft = create('DRAFT', 0, null);
    expect(draft.nativeElement.textContent).toContain('Todavía no está abierto');
    expect(draft.nativeElement.textContent).toContain('se habilitan cuando se abra');

    const settlement = create('SETTLEMENT', 10, 500_000);
    expect(settlement.nativeElement.textContent).toContain('Estimado previo');
    expect(settlement.nativeElement.textContent).toContain('No disponible como valor final');
    expect(settlement.nativeElement.textContent).not.toContain('5.000');
  });

  function create(status: 'DRAFT' | 'OPEN' | 'SETTLEMENT', count: number, estimate: number | null) {
    const fixture = TestBed.createComponent(MatchSummaryCard);
    fixture.componentRef.setInput('confirmedCount', count);
    fixture.componentRef.setInput('courtPriceMinor', 5_000_000);
    fixture.componentRef.setInput('eventStatus', status);
    fixture.componentRef.setInput('estimatedPerPlayerMinor', estimate);
    fixture.detectChanges();
    return fixture;
  }
});
