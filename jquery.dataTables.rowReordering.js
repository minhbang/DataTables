/*
 * jquery.dataTables.rowReordering.js
 * Forked from http://jquery-datatables-row-reordering.googlecode.com/svn/trunk/index.html
 * Modify by Minh Bang <contact@minhbang.com>
 */
(function ($, undefined) {
    "use strict";
    $.fn.rowReordering = function (options) {
        function _fnStartProcessingMode(oTable) {
            if (oTable.fnSettings().oFeatures.bProcessing) {
                $(".dataTables_processing").css('visibility', 'visible');
            }
        }

        function _fnEndProcessingMode(oTable) {
            if (oTable.fnSettings().oFeatures.bProcessing) {
                $(".dataTables_processing").css('visibility', 'hidden');
            }
        }

        function fnCancelSorting(oTable, tbody, properties, iLogLevel, sMessage) {
            tbody.sortable('cancel');
            if (iLogLevel <= properties.iLogLevel) {
                if (sMessage != undefined) {
                    properties.fnAlert(sMessage, "");
                } else {
                    properties.fnAlert("Row cannot be moved", "");
                }
            }
            properties.fnEndProcessingMode(oTable);
        }

        function fnGetState(oTable, sSelector, id) {
            var tr = $("#" + id, oTable);
            var iCurrentPosition = oTable.fnGetData(tr[0], properties.iIndexColumn);
            var iNewPosition = -1;
            var sDirection;
            var trPrevious = tr.prev(sSelector);
            var trNext = tr.next(sSelector);
            var sPreviousId = null;
            var sNextId = null;
            if (trNext.length > 0) {
                sNextId = trNext.attr('id');
            }
            if (trPrevious.length > 0) {
                iNewPosition = parseInt(oTable.fnGetData(trPrevious[0], properties.iIndexColumn));
                if (iNewPosition < iCurrentPosition) {
                    iNewPosition = iNewPosition + 1;
                }
                sPreviousId = trPrevious.attr('id');
            } else {
                if (trNext.length > 0) {
                    iNewPosition = parseInt(oTable.fnGetData(trNext[0], properties.iIndexColumn));
                    if (iNewPosition > iCurrentPosition)//moved back
                        iNewPosition = iNewPosition - 1;
                }
            }
            if (iNewPosition < iCurrentPosition) {
                sDirection = "back";
            } else {
                sDirection = "forward";
            }
            return {
                sDirection: sDirection,
                iCurrentPosition: iCurrentPosition,
                iNewPosition: iNewPosition,
                sPreviousId: sPreviousId,
                sNextId: sNextId
            };
        }

        function fnMoveRows(oTable, sSelector, iCurrentPosition, iNewPosition, sDirection, id, sGroup) {
            var iStart = iCurrentPosition;
            var iEnd = iNewPosition;
            if (sDirection == "back") {
                iStart = iNewPosition;
                iEnd = iCurrentPosition;
            }

            $(oTable.fnGetNodes()).each(function () {
                if (sGroup != "" && $(this).attr("data-group") != sGroup)
                    return;
                var tr = this;
                var iRowPosition = parseInt(oTable.fnGetData(tr, properties.iIndexColumn));
                if (iStart <= iRowPosition && iRowPosition <= iEnd) {
                    if (tr.id == id) {
                        oTable.fnUpdate(iNewPosition,
                            oTable.fnGetPosition(tr), // get row position in current model
                            properties.iIndexColumn,
                            false); // false = defer redraw until all row updates are done
                    } else {
                        if (sDirection == "back") {
                            oTable.fnUpdate(iRowPosition + 1,
                                oTable.fnGetPosition(tr), // get row position in current model
                                properties.iIndexColumn,
                                false); // false = defer redraw until all row updates are done
                        } else {
                            oTable.fnUpdate(iRowPosition - 1,
                                oTable.fnGetPosition(tr), // get row position in current model
                                properties.iIndexColumn,
                                false); // false = defer redraw until all row updates are done
                        }
                    }
                }
            });

            var oSettings = oTable.fnSettings();

            //Standing Redraw Extension
            //Author: 	Jonathan Hoguet
            //http://datatables.net/plug-ins/api#fnStandingRedraw
            if (oSettings.oFeatures.bServerSide === false) {
                var before = oSettings._iDisplayStart;
                oSettings.oApi._fnReDraw(oSettings);
                //iDisplayStart has been reset to zero - so lets change it back
                oSettings._iDisplayStart = before;
                oSettings.oApi._fnCalculateEnd(oSettings);
            }
            //draw the 'current' page
            oSettings.oApi._fnDraw(oSettings);
        }

        function _fnAlert(message, type) {
            alert(message);
        }

        var defaults = {
            iIndexColumn: 0,
            iStartPosition: 1,
            sURL: null,
            sToken: null,
            sRequestType: "POST",
            iGroupingLevel: 0,
            fnAlert: _fnAlert,
            fnSuccess: jQuery.noop,
            iLogLevel: 1,
            sDataGroupAttribute: "data-group",
            fnStartProcessingMode: _fnStartProcessingMode,
            fnEndProcessingMode: _fnEndProcessingMode,
            fnUpdateAjaxRequest: jQuery.noop,
            oContainment: false
        };

        var properties = $.extend(defaults, options);

        // Return a helper with preserved width of cells (see Issue 9)
        var tableFixHelper = function (e, tr) {
            var $originals = tr.children();
            var $helper = tr.clone();
            $helper.children().each(function (index) {
                // Set helper cell sizes to match the original sizes
                $(this).width($originals.eq(index).width())
            });
            return $helper;
        };

        return this.each(function () {

            var oTable = $(this).dataTable();

            var aaSortingFixed = (oTable.fnSettings().aaSortingFixed == null ? new Array() : oTable.fnSettings().aaSortingFixed);
            aaSortingFixed.push([properties.iIndexColumn, "asc"]);

            oTable.fnSettings().aaSortingFixed = aaSortingFixed;


            for (var i = 0; i < oTable.fnSettings().aoColumns.length; i++) {
                oTable.fnSettings().aoColumns[i].bSortable = false;
            }
            oTable.fnDraw();

            $("tbody", oTable).disableSelection().sortable({
                cursor: "move",
                helper: tableFixHelper,
                containment: properties.oContainment,
                axis: "y",
                start: function (e, ui) {
                    ui.placeholder.height(ui.item.height());
                },
                update: function (event, ui) {
                    var $dataTable = oTable;
                    var tbody = $(this);
                    var sSelector = "tbody tr";
                    var sGroup = "";
                    if (properties.bGroupingUsed) {
                        sGroup = $(ui.item).attr(properties.sDataGroupAttribute);
                        if (sGroup == null || sGroup == undefined) {
                            fnCancelSorting($dataTable, tbody, properties, 3, "Grouping row cannot be moved");
                            return;
                        }
                        sSelector = "tbody tr[" + properties.sDataGroupAttribute + " ='" + sGroup + "']";
                    }
                    var oState = fnGetState($dataTable, sSelector, ui.item.context.id);
                    if (oState.iNewPosition == -1) {
                        fnCancelSorting($dataTable, tbody, properties, 2);
                        return;
                    }

                    if (properties.sURL != null) {
                        properties.fnStartProcessingMode($dataTable);
                        var oAjaxRequest = {
                            url: properties.sURL,
                            type: properties.sRequestType,
                            data: {
                                _token: properties.sToken,
                                id: ui.item.context.id,
                                id_prev: oState.sPreviousId,
                                id_next: oState.sNextId,
                                group: sGroup
                            },
                            success: function (data) {
                                properties.fnSuccess(data);
                                fnMoveRows($dataTable, sSelector, oState.iCurrentPosition, oState.iNewPosition, oState.sDirection, ui.item.context.id, sGroup);
                                properties.fnEndProcessingMode($dataTable);
                            },
                            error: function (jqXHR) {
                                fnCancelSorting($dataTable, tbody, properties, 1, jqXHR.statusText);
                            }
                        };
                        properties.fnUpdateAjaxRequest(oAjaxRequest, properties, $dataTable);
                        $.ajax(oAjaxRequest);
                    } else {
                        fnMoveRows($dataTable, sSelector, oState.iCurrentPosition, oState.iNewPosition, oState.sDirection, ui.item.context.id, sGroup);
                    }
                }
            });
        });
    };
})(jQuery);