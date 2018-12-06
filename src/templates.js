module.exports.footerTemplate = `
    <div style='font-size: 8px; font-family: helvetica; width: 100%;'>
        <div style='width: 75%; text-align: center; float: left;'>
            <div style='width: 300px; text-align: center; float: right;'>
                <span>Mis Expensas | Gobierno de la Ciudad | www.buenosaires.gob.ar</span>
                <br>
                <span>www.octopus.com.ar</span>
            </div>
        </div>
        <div style='width: 25%; float: right; text-align: center;'>
            <span>Página <span class='pageNumber'></span> de <span class="totalPages"></span></span>
        </div>
    </div>
`;

module.exports.headerTemplate = `
    <div style='transform: rotate(-90deg); font-family: helvetica; font-size: 7px; height: 500px; width: 520px;'>
        Procesado por <b>OCTOPUS</b> - 0800-362-OCTO (6286)
    </div>
`;