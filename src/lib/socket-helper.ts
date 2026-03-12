declare global {
  var socketServer: any;
}

/**
 * Отправляет событие обновления заказа подключенным WebSocket клиентам
 * @param orderId ID заказа, который изменился 
 */
export function emitOrderUpdate(orderId: string) {
  if (global.socketServer) {
    global.socketServer.to(`order_${orderId}`).emit("orderUpdated", { orderId });
    console.log(`[Socket] Emitted orderUpdated for order_${orderId}`);
  }
}
