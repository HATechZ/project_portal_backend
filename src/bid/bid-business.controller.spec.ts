import { BidBusinessController } from './bid-business.controller';
import { BidBusinessOutcomeInput } from './dtos/bid-business.dto';

describe('BidBusinessController C3 contract wiring', () => {
  const actor = { id: 'actor-a' } as never;
  const service = {
    readiness: jest.fn(), history: jest.fn(), win: jest.fn(), reject: jest.fn(), requestArchivedReview: jest.fn(), restore: jest.fn(),
  };
  const controller = new BidBusinessController(service as never);

  beforeEach(() => jest.clearAllMocks());

  it('delegates readiness and history without calculating or querying in the controller', () => {
    controller.readiness('11111111-1111-4111-8111-111111111111', actor);
    controller.history('11111111-1111-4111-8111-111111111111', actor);
    expect(service.readiness).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111', actor);
    expect(service.history).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111', actor);
  });

  it('routes WON and REJECTED to their authoritative C3-B commands', () => {
    controller.outcome('bid-a', { outcome: BidBusinessOutcomeInput.WON, note: 'won' }, actor);
    controller.outcome('bid-a', { outcome: BidBusinessOutcomeInput.REJECTED, note: 'lost' }, actor);
    expect(service.win).toHaveBeenCalledWith({ bidId: 'bid-a', note: 'won' }, actor);
    expect(service.reject).toHaveBeenCalledWith({ bidId: 'bid-a', note: 'lost' }, actor);
  });

  it('passes review and restore notes through without server-owned fields', () => {
    controller.requestReview('bid-a', { note: 'review' }, actor);
    controller.restore('bid-a', { note: 'restore' }, actor);
    expect(service.requestArchivedReview).toHaveBeenCalledWith({ bidId: 'bid-a', note: 'review' }, actor);
    expect(service.restore).toHaveBeenCalledWith({ bidId: 'bid-a', note: 'restore' }, actor);
  });
});
