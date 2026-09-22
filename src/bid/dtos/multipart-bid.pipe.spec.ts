import { CreateBidMultipartPipe } from './multipart-bid.pipe';
describe('Bid flat multipart pipe', () => {
  it('accepts repeated document code IDs in file order', () => {
    const value = new CreateBidMultipartPipe().transform({
      name: 'Salina',
      clientId: '11111111-1111-4111-8111-111111111111',
      biddingNumber: '21128',
      polOptionId: '22222222-2222-4222-8222-222222222222',
      podOptionId: '33333333-3333-4333-8333-333333333333',
      cargoCodeOptionId: '44444444-4444-4444-8444-444444444444',
      vesselCodeOptionId: '55555555-5555-4555-8555-555555555555',
      shipmentNumber: '01',
      documentCodeOptionIds: [
        '66666666-6666-4666-8666-666666666666',
        '66666666-6666-4666-8666-666666666666',
      ],
    });
    expect(value.documentCodeOptionIds).toHaveLength(2);
  });
});
