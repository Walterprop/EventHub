// Middleware per trasformare i dati del frontend al formato del backend
const transformEventData = (req, res, next) => {
  try {
    console.log('🔄 Dati originali dal frontend:', req.body);
    
    const { location, city, date, time, maxParticipants, price, ...otherData } = req.body;
    
    // Creare oggetto data completo
    const eventDateTime = new Date(`${date}T${time}`);
    const eventEndTime = new Date(eventDateTime.getTime() + 2 * 60 * 60 * 1000); // +2 ore di default
    
    // Gestire location che può essere stringa o oggetto
    let locationObj;
    if (typeof location === 'object' && location !== null) {
      locationObj = {
        address: location.address || '',
        city: location.city || city || '',
        country: 'Italia'
      };
    } else {
      locationObj = {
        address: location || '',
        city: city || '',
        country: 'Italia'
      };
    }
    
    // Trasformare al formato del modello
    req.body = {
      ...otherData,
      location: locationObj,
      date: {
        start: eventDateTime.toISOString(),
        end: eventEndTime.toISOString()
      },
      capacity: parseInt(maxParticipants) || 50,
      price: {
        amount: parseFloat(price) || 0,
        currency: 'EUR',
        isFree: !price || parseFloat(price) === 0
      }
    };
    
    console.log('✅ Dati trasformati:', req.body);
    next();
  } catch (error) {
    console.error('❌ Errore trasformazione dati:', error);
    return res.status(400).json({
      success: false,
      message: 'Errore nella trasformazione dei dati',
      error: error.message
    });
  }
};

module.exports = transformEventData;